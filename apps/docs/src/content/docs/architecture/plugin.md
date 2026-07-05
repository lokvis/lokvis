---
title: Plugin Layer (Deep Dive)
description: Plugin lifecycle, PluginContext, and the Runtime↔Engine bridge.
draft: false
head: []
---

# Plugin Layer (Deep Dive)

Plugins are the **only** way to add capabilities to Lokvis. A plugin is a declarative spec (`PluginConfig`) plus an installer function that wires the spec's capabilities to actual engine implementations via a restricted `PluginContext`. Plugins sit in the **Capability Layer** — they bridge the Runtime (which schedules work) and the Engine Layer (which does pixel work).

This page documents [`@lokvis/plugin-sdk`](https://github.com/lokvis/lokvis/tree/dev/packages/plugin-sdk/src) and the plugin lifecycle.

> **Plugin SDK vs MCP Server**: Plugin SDK is in **Alpha preview** for browser-embedding scenarios. If you want AI clients (Claude / ChatGPT / Cursor) to invoke local capabilities, prefer the [MCP Server](../mcp) path. See [Plugins vs MCP](../plugins#plugin-sdk-vs-mcp-server).

## Module map

```
packages/plugin-sdk/src/
├── index.ts                       ← Re-exports
├── (definePlugin)                 ← Plugin factory
├── (createCapabilityImpl)         ← Low-level impl wrapper
├── (createBlobCapabilityImpl)     ← High-level Blob→Blob factory (preferred)
├── (defaultDeriveOutputMetadata)  ← Default metadata propagation
└── (definePanel)                  ← UI panel definition helper
```

The SDK is tiny — most of it is type re-exports from `@lokvis/schema` plus three factory functions. The real work happens in the plugin packages themselves (`plugin-image`, `plugin-dev`, future `plugin-pdf` / `plugin-video`).

## The `Plugin` object

A plugin is just a `{ config, install }` pair:

```typescript
export interface Plugin {
  config: PluginConfig;
  install: (ctx: PluginContext) => void | Promise<void>;
}

export interface PluginConfig {
  name: string;                          // 'lokvis-image-tools'
  version: string;
  description?: string;
  capabilities: Capability[];            // declarations
  engine?: string;                       // default engine name
  permissions: PluginPermission[];       // ['asset:read', 'asset:write', 'network:none']
}
```

`definePlugin(config, installer)` is the canonical constructor — it just wraps the two in an object. You can also construct the object literal by hand, but `definePlugin` is the documented path.

## The plugin lifecycle

```
createLokvis({ plugins: [imageToolsPlugin(), blurImagePlugin()] })
   │
   ├─ for each plugin:
   │   ├─ registry.registerCapability(cap)   ← for each capability in config.capabilities
   │   └─ plugin.install(ctx)                 ← installer runs, calls ctx.registerCapability(impl)
   │
   └─ (later) runtime.run(workflow, inputs)
       └─ executor calls registry.resolve(node.capability)
           └─ impl.execute(inputs, params, execCtx)
               └─ (inside impl) ctx.runtime.getAssetBlob / createAsset / etc.
```

The `install` phase is synchronous-friendly but allowed to be async (e.g. to lazy-load a WASM engine). If `install` throws, the SDK's `installPlugin()` wraps the error in `PluginLoadError` with `code: 'PLUGIN_LOAD_FAILED'`.

You can also load a plugin into an already-created Runtime via `loadPlugin(lokvis, plugin)` — same flow, just deferred.

## `PluginContext` — the restricted Runtime view

Plugins never get the full `LokvisRuntime` instance. They get a `PluginContext` that exposes only what they need:

```typescript
export interface PluginContext {
  runtime: {
    getAsset(id: AssetId): Promise<Asset>;
    getAssetBlob(asset: Asset): Promise<Blob>;
    createAsset(blob: Blob, metadata: AssetMetadata, type: AssetType): Promise<Asset>;
    listCapabilities(): Promise<Capability[]>;
  };
  registerCapability(impl: CapabilityImplementation): void;
  registerMetadataReader<T>(name: string, fn: MetadataReader<T>): void;
  registerPanel(panel: PanelDefinition): void;
  eventBus: EventBus;
  log(level: 'info' | 'warn' | 'error', message: string): void;
}
```

| Member | Purpose |
|--------|---------|
| `runtime.getAsset(id)` | Read asset metadata |
| `runtime.getAssetBlob(asset)` | Read asset bytes (the `Blob`) |
| `runtime.createAsset(blob, metadata, type)` | Persist a new asset and get its `Asset` reference |
| `runtime.listCapabilities()` | Inspect other registered capabilities (for cross-plugin coordination) |
| `registerCapability(impl)` | Register a `CapabilityImplementation` (engine + execute fn) |
| `registerMetadataReader(name, fn)` | Register a `MetadataReader` (e.g. EXIF reader) |
| `registerPanel(panel)` | Register a custom UI panel |
| `eventBus` | Emit / listen to Runtime events |
| `log(level, message)` | Structured logging (forwarded to console + future telemetry) |

The `runtime` here is a **subset** of the `LokvisRuntime` interface — no `run`, no `cancel`, no `disposeWorkflow`. This is intentional: plugins should not start workflows or cancel them; they only provide capabilities.

## `createBlobCapabilityImpl` — the preferred factory

Most capabilities are **single-input → single-output Blob transformations**: take an asset's blob, transform it, return a new asset. The `createBlobCapabilityImpl` factory encapsulates the 5-step boilerplate:

```typescript
export function createBlobCapabilityImpl(
  options: {
    capability: string;
    engine: string;
    outputType: AssetType;
    operation: (blob, params, signal?) => Promise<Blob>;
    isStub: boolean;
    deriveMetadata?: (source: Asset, outBlob: Blob) => AssetMetadata;
  },
  ctx: PluginContext
): CapabilityImplementation
```

The factory returns a `CapabilityImplementation` whose `execute` does:

1. Validate `inputs.length > 0`
2. For each input asset:
   - Check `execCtx.signal.aborted`
   - Call `execCtx.onProgress(i / inputs.length, ...)`
   - `const blob = await ctx.runtime.getAssetBlob(asset)`
   - `const outBlob = await operation(blob, params, execCtx.signal)`
   - `const metadata = deriveMetadata(asset, outBlob)`
   - `const outAsset = await ctx.runtime.createAsset(outBlob, metadata, outputType)`
   - Push to outputs
3. Call `execCtx.onProgress(1, 'Done')` and return outputs

`defaultDeriveOutputMetadata` is the default `deriveMetadata` — it propagates `dimensions` from the source and reads `mimeType` / `size` / `format` from the output blob. Override it for operations that change dimensions (e.g. resize, crop).

## Worked example: `plugin-image`

The official image plugin is ~70 lines of plugin code. Here's the entire flow:

```typescript
// packages/plugin-image/src/plugin.ts
export function imageToolsPlugin() {
  return definePlugin(
    {
      name: 'lokvis-image-tools',
      version: '0.1.0',
      capabilities: IMAGE_CAPABILITIES,  // 9 capabilities from @lokvis/capability
      engine: 'canvas',
      permissions: ['asset:read', 'asset:write', 'network:none'],
    },
    (ctx) => {
      // 9 transform capabilities (Asset → Asset, via CapabilityRegistry / executor)
      const impls = buildImageCapabilityImplementations(ctx);
      for (const impl of impls) ctx.registerCapability(impl);

      // 1 metadata reader (Asset → ExifData, NOT a Capability — bypasses executor)
      ctx.registerMetadataReader<ExifData>('image.read-exif', async (asset) => {
        const blob = await ctx.runtime.getAssetBlob(asset);
        return readExifFromBlob(blob);
      });

      ctx.log('info', `Registered ${impls.length} image capabilities + EXIF reader`);
    }
  );
}
```

`buildImageCapabilityImplementations(ctx)` reads `IMAGE_CAPABILITY_ENTRIES` (a static array mapping capability names to engine operation functions) and calls `createBlobCapabilityImpl` for each. The whole plugin is essentially a lookup table + factory calls.

## `MetadataReader` — the exception to the Capability contract

Most plugin functionality fits the `Asset[] → Asset[]` Capability contract. But some operations are **queries** — they return data, not assets. EXIF reading is the canonical example: `Asset → ExifData` does not fit `Asset[] → Asset[]`.

For these, plugins use `ctx.registerMetadataReader(name, fn)` instead. The Runtime stores them in a separate `Map<string, MetadataReader>` and exposes them via `runtime.readAssetExif(assetId)` (or future `readAssetXxx`). The Runtime calls the reader by name; if no plugin has registered one, it returns `null` (graceful degradation — the UI just shows "no EXIF data").

This separation keeps the Capability contract clean (`Asset[] → Asset[]` only) while still letting plugins provide query-style functionality.

## Stub plugins

When a domain's engine isn't ready yet (video / PDF / audio in Phase 1), the plugin still ships — but its operations all throw `new Error('xxx not implemented in stub')` and `createBlobCapabilityImpl` is called with `isStub: true`. The factory then sets `CapabilityImplementation.status = 'stub'`, and the `CapabilityRegistry.resolve()` filters it out.

This means:

- The capability **declaration** is visible (UI / MCP manifest / docs list it)
- The capability **implementation** is not selectable (workflow executor throws `CAPABILITY_STUB_ONLY`)
- No crash mid-execution

When Phase 2 ships the real engine, the plugin swaps `isStub: false` and removes the throwing stub operations — no other layer needs to change.

## Permissions

```typescript
permissions: ['asset:read', 'asset:write', 'network:none']
```

- `asset:read` / `asset:write` — required for `getAssetBlob` / `createAsset`
- `network:none` — explicitly disallow network access (default for image tools)
- `network:fetch` — required if the engine calls `fetch()` (e.g. downloading a watermark image URL)

In the Alpha, permissions are **advisory** — the Runtime does not yet enforce them at the API boundary. Phase 2 will add hard enforcement (e.g. refusing `fetch` calls from a plugin that didn't declare `network:fetch`). The declaration is in place now so the contract is stable.

## Panels (UI extension)

`ctx.registerPanel(panel)` lets a plugin contribute a UI panel. `PanelDefinition` is a minimal spec (id / title / capability association / render hint). The actual rendering happens in `@lokvis/ui-react` via a panel registry — the plugin just declares what panels it wants, and the UI layer looks them up.

In Phase 1 this is used lightly (the dev tools plugin registers an inspector panel). Phase 2 will use it more heavily for engine-specific UIs (e.g. a PDF page picker).

## Testing plugins

Plugins are pure functions over a `PluginContext`, so they're trivially testable. The standard pattern:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { blurImagePlugin } from '../plugin.js';

describe('blurImagePlugin', () => {
  it('声明 image.blur 能力', () => {
    const plugin = blurImagePlugin();
    expect(plugin.config.name).toBe('lokvis-blur-image');
    expect(plugin.config.capabilities).toHaveLength(1);
  });

  it('installer 注册实现', () => {
    const registered: string[] = [];
    const ctx = {
      registerCapability: (impl) => registered.push(impl.capability),
      registerMetadataReader: vi.fn(),
      log: vi.fn(),
      runtime: { /* mocks */ },
      eventBus: { on: vi.fn(), emit: vi.fn() },
    };
    plugin.install(ctx as any);
    expect(registered).toEqual(['image.blur']);
  });
});
```

Browser-only APIs (`OffscreenCanvas`, `createImageBitmap`) need fakes — see `AGENTS.md` §测试约定.

## What the Plugin layer explicitly does NOT do

- Implement pixel operations (that's the Engine layer's job)
- Manage the AssetStore (it calls `ctx.runtime.createAsset`, not the store directly)
- Know about React / Redux / Cloud (plugins are framework-agnostic)
- Enforce Pro limits (delegated to `BatchProcessor` and the UI)
- Start or cancel workflows (plugins only **provide** capabilities)

## Further reading

- [Write Your First Plugin](../guides/write-first-plugin) — step-by-step tutorial
- [Plugins reference](../plugins) — official plugin list + PluginContext API summary
- [Runtime Layer](./runtime) — what plugins plug into
- [Engine Layer](./engine) — what plugins wrap
- [Capability Layer](./capability) — what plugins declare
