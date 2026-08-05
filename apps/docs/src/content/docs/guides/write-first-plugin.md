---
title: Write Your First Plugin
description: Build @lokvis/blur-image from scratch — declare a capability, wrap a Blob→Blob engine operation, register it with definePlugin(), and test it with Vitest.
draft: false
head: []
---

# Write Your First Plugin

This guide builds a `@lokvis/blur-image` plugin from scratch. You will declare a capability, write a Blob→Blob engine operation, assemble everything with `definePlugin()` + `createBlobCapabilityImpl()`, load the plugin, invoke it through a workflow, and add a Vitest test.

> **Plugin SDK is Alpha.** Plugins are intended for embedding Lokvis into your own web app. If you want AI clients (Claude / Cursor / ChatGPT) to invoke your capability, use [`@lokvis/mcp-server`](../mcp) instead.

## 1. Project layout

```
@lokvis/blur-image/
├── package.json
├── tsconfig.json
└── src/
    ├── index.ts       # Public exports
    ├── engine.ts      # Blob→Blob pure function (Engine layer)
    └── plugin.ts      # definePlugin + createBlobCapabilityImpl
```

`package.json` peer-depends on `@lokvis/plugin-sdk` and `@lokvis/schema`:

```json
{
  "name": "@lokvis/blur-image",
  "version": "0.1.0",
  "type": "module",
  "main": "src/index.ts",
  "peerDependencies": {
    "@lokvis/plugin-sdk": "workspace:*",
    "@lokvis/schema": "workspace:*"
  }
}
```

## 2. Declare the capability

A `Capability` describes the contract: name, accepted input asset types, produced output asset types, and parameters. Each parameter has a `CapabilityParamType` — one of `number | string | boolean | enum | color | file | array | object`.

```ts
// src/plugin.ts
import type { Capability } from '@lokvis/schema';

const BLUR_CAPABILITY: Capability = {
  name: 'image.blur',
  description: 'Apply a Gaussian-style blur to an image',
  inputTypes: ['image'],
  outputTypes: ['image'],
  params: [
    {
      name: 'radius',
      type: 'number',
      required: false,
      min: 1,
      max: 100,
      default: 4,
      description: 'Blur radius in pixels',
    },
  ],
  performance: 'fast',
  batchable: true,
  mcpExposure: 'public',
};
```

## 3. Write the engine operation (Blob → Blob)

The Engine layer exposes **pure Blob → Blob functions** that are completely unaware of `Asset`, `Workflow`, or `Plugin`. Per the workspace's `AGENTS.md`, the operation signature must accept `Record<string, any>` for params — not a typed interface:

```ts
// src/engine.ts
import { decodeImage, encodeImage, createCanvas, get2DContext } from '@lokvis/engine-image';
import { throwIfAborted } from '@lokvis/engine-image';

/**
 * Blur the input image with a Canvas filter.
 *
 * AGENTS.md: Blob↔Blob pure function. Params MUST be Record<string, any>
 * so the Capability layer (which receives Record<string, unknown> from the
 * executor) can pass them through with a single `as` assertion — never
 * `as unknown as` double assertion.
 */
export async function blur(
  blob: Blob,
  params: Record<string, any>,
  signal?: AbortSignal
): Promise<Blob> {
  const radius = Number(params.radius ?? 4);
  const { bitmap, width, height } = await decodeImage(blob);
  throwIfAborted(signal);

  const canvas = createCanvas(width, height);
  const ctx = get2DContext(canvas);
  // OffscreenCanvasRenderingContext2D + HTMLCanvasRenderingContext2D both support filter
  // @ts-expect-error filter exists on both 2D context variants
  ctx.filter = `blur(${radius}px)`;
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close?.();
  throwIfAborted(signal);

  return encodeImage(canvas, 'png', 95);
}
```

### Why `Record<string, any>` and not a typed interface

The Capability layer (`plugin-image`, `plugin-pdf`, `plugin-video`) receives `Record<string, unknown>` from the executor's `params` field. TypeScript does not allow a direct cast between an `interface` and `Record<string, unknown>`. If the engine function declared `params: BlurParams`, the plugin layer would need the `as unknown as BlurParams` double assertion — explicitly **forbidden** by `AGENTS.md` (with the only exception being cross-boundary Worker scope).

By accepting `Record<string, any>` in the engine and doing a single `as BlurParams` inside the function body, the plugin layer just calls `blur(blob, params, signal)` — no assertions at the call site.

## 4. Assemble with `definePlugin()` + `createBlobCapabilityImpl()`

`createBlobCapabilityImpl()` is a factory from `@lokvis/plugin-sdk` that encapsulates the 5-step boilerplate every Blob→Blob capability shares:

1. Get each input asset's Blob via `ctx.runtime.getAssetBlob(asset)`
2. Call the engine `operation(blob, params, signal)`
3. Derive output metadata from source asset + output blob
4. Create the output asset via `ctx.runtime.createAsset(blob, metadata, outputType)`
5. Emit progress + check `signal.aborted` between iterations

```ts
// src/plugin.ts (continued)
import { definePlugin, createBlobCapabilityImpl } from '@lokvis/plugin-sdk';
import { blur } from './engine.js';

export const PLUGIN_NAME = 'lokvis-blur-image';
export const PLUGIN_VERSION = '0.1.0';
export const PLUGIN_ENGINE = 'canvas';

export function blurImagePlugin() {
  return definePlugin(
    {
      name: PLUGIN_NAME,
      version: PLUGIN_VERSION,
      description: 'Gaussian-style image blur (Canvas engine)',
      capabilities: [BLUR_CAPABILITY],
      engine: PLUGIN_ENGINE,
      permissions: ['asset:read', 'asset:write', 'network:none'],
    },
    (ctx) => {
      // detect stub engine per AGENTS.md
      const isStub = PLUGIN_ENGINE.includes('stub');

      const impl = createBlobCapabilityImpl(
        {
          capability: 'image.blur',
          engine: PLUGIN_ENGINE,
          outputType: 'image',
          operation: blur,
          isStub,
        },
        ctx
      );
      ctx.registerCapability(impl);
      ctx.log('info', `Registered image.blur capability`);
    }
  );
}
```

The factory sets `CapabilityImplementation.status = 'stub'` automatically when `isStub` is `true`. `CapabilityRegistry.resolve()` skips stub implementations, so the executor throws `CapabilityStubOnlyError` if a user tries to invoke a stub-only capability — instead of running into `not implemented` errors deep in the engine.

## 5. PluginContext API

The `ctx` argument passed to your installer is a **restricted view** of the Runtime — plugins can never reach React, Redux, or Cloud. It exposes 9 members:

| Member | Signature | Purpose |
|---|---|---|
| `runtime.getAsset` | `(id) => Promise<Asset>` | Read asset metadata |
| `runtime.importAsset` | `(file: File \| Blob) => Promise<string>` | Import a File or Blob, returns AssetId |
| `runtime.getAssetBlob` | `(asset) => Promise<Blob>` | Read the asset's raw bytes for processing |
| `runtime.createAsset` | `(blob, metadata, type) => Promise<Asset>` | Create a new asset (capability output) |
| `runtime.listCapabilities` | `() => Promise<Capability[]>` | Query all registered capabilities |
| `eventBus` | `EventBus` | Emit/listen to `LokvisEvent` |
| `registerCapability` | `(impl: CapabilityImplementation) => void` | Register a transform (Asset → Asset) |
| `registerMetadataReader` | `<T>(name, reader: MetadataReader<T>) => void` | Register a query (Asset → T), e.g. EXIF reader |
| `registerPanel` | `(panel: PanelDefinition) => void` | Register a UI panel (rendered by the host app) |
| `log` | `(level, message) => void` | Structured logging (`info` / `warn` / `error`) |

The Plugin never sees `run()`, `undo()`, `disposeWorkflow()`, or any internal `_`-prefixed members — those are Runtime-private.

## 6. Stub engine handling

A "stub engine" is a placeholder implementation of an Engine adapter (e.g. `engine-video`, `engine-pdf` before Phase 2). Per `AGENTS.md`, stub engines:

- Have a `version` string containing `'stub'`
- Throw `new Error('xxx not implemented in stub')` from every operation method
- List `supportedCapabilities` for future planning

The plugin layer detects this and propagates it:

```ts
const isStub = engine.version.includes('stub');
// → createBlobCapabilityImpl sets CapabilityImplementation.status = 'stub'
// → CapabilityRegistry.resolve() filters out stub impls
// → Executor throws CapabilityStubOnlyError if no real impl is available
```

This is why your `blur-image` plugin should declare `isStub` from its own engine identifier rather than blindly assuming the engine is real.

## 7. Permissions (Alpha advisory)

During Alpha, plugin permissions are **advisory only** — they are declared in `PluginConfig.permissions` but not enforced. The accepted values are:

- `asset:read` / `asset:write` — read or create assets
- `network:none` / `network:limited` / `network:full` — network access level
- `filesystem:opfs` / `filesystem:local` — file system scope

Phase 2 will introduce enforcement. For now, declare permissions truthfully so future enforcement does not break your plugin.

## 8. Load the plugin

```ts
import { createLokvis, loadPlugin } from '@lokvis/sdk';
import { imageToolsPlugin } from '@lokvis/plugin-image';
import { blurImagePlugin } from '@lokvis/blur-image';

// Option A: preload at construction
const lokvis = await createLokvis({
  plugins: [imageToolsPlugin(), blurImagePlugin()],
});

// Option B: load at runtime (e.g. user toggles a feature)
const runtime = await createLokvis({ plugins: [imageToolsPlugin()] });
await loadPlugin(runtime, blurImagePlugin());
```

Both paths share the same `installPlugin()` internal — they register capabilities, build a `PluginContext`, run `plugin.install(ctx)`, and emit `plugin:loaded`.

## 9. Invoke through a workflow

```ts
const assetId = await lokvis.importAsset({ kind: 'file', file });

const workflow = {
  id: 'blur-demo',
  version: '1.0.0',
  name: 'Blur demo',
  description: 'Apply a 6px blur',
  author: { id: 'local', name: 'Local User' },
  category: 'image',
  tags: ['blur'],
  nodes: [
    { id: 'n-blur', type: 'transform', capability: 'image.blur', params: { radius: 6 } },
  ],
  edges: [],
  inputs: { type: 'image', multiple: false, accept: ['image/*'] },
  outputs: { type: 'image', format: 'png' },
};

const result = await lokvis.run(workflow, [assetId]);
const blob = await lokvis.exportAsset(result.outputs[0]!);
```

## 10. Vitest test pattern

Lokvis uses Vitest with `globals: false` (explicit imports), tests in `src/__tests__/`, and Chinese test descriptions. Browser APIs (`Canvas`, `createImageBitmap`, `OffscreenCanvas`) should be faked via `@lokvis/browser-adapter`'s `createFakeAdapter()` (or per-interface fakes) rather than `vi.stubGlobal` — see [ADR-015](../../architecture#adr-015).

```ts
// src/__tests__/plugin.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Asset, CapabilityImplementation, PluginContext } from '@lokvis/schema';

// Fake the engine so the test runs without a real Canvas
vi.mock('@lokvis/engine-image', () => ({
  decodeImage: vi.fn(), encodeImage: vi.fn(async () => new Blob()),
  createCanvas: vi.fn(),
  get2DContext: vi.fn(() => ({ filter: '', drawImage: vi.fn() })),
  throwIfAborted: vi.fn(),
}));

const { blurImagePlugin, PLUGIN_NAME } = await import('../plugin.js');

function createMockContext(): { ctx: PluginContext; registered: CapabilityImplementation[] } {
  const registered: CapabilityImplementation[] = [];
  const ctx: PluginContext = {
    runtime: {
      getAsset: vi.fn(async (id: string) => ({ id }) as Asset),
      importAsset: vi.fn(async () => 'asset-id'),
      getAssetBlob: vi.fn(async () => new Blob([new Uint8Array([0])], { type: 'image/png' })),
      createAsset: vi.fn(async (blob, metadata, type) => ({
        id: 'out-1', type, metadata,
        blob: { path: 'memory://out-1', size: blob.size, mimeType: metadata.mimeType },
        history: [], tags: [], createdAt: 0, updatedAt: 0,
      }) as Asset),
      listCapabilities: vi.fn(async () => []),
    },
    eventBus: { on: vi.fn(), onAny: vi.fn(), emit: vi.fn(), clear: vi.fn() },
    registerCapability: vi.fn((impl) => registered.push(impl)),
    registerMetadataReader: vi.fn(),
    registerPanel: vi.fn(),
    log: vi.fn(),
  };
  return { ctx, registered };
}

describe('blurImagePlugin', () => {
  it('应注册 image.blur 能力声明', () => {
    const plugin = blurImagePlugin();
    expect(plugin.config.name).toBe(PLUGIN_NAME);
    expect(plugin.config.capabilities).toHaveLength(1);
    expect(plugin.config.capabilities[0]!.name).toBe('image.blur');
  });

  it('installer 应通过 ctx.registerCapability 注册实现', async () => {
    const { ctx, registered } = createMockContext();
    const plugin = blurImagePlugin();
    await plugin.install(ctx);
    expect(registered).toHaveLength(1);
    expect(registered[0]!.capability).toBe('image.blur');
    expect(registered[0]!.engine).toBe('canvas');
  });
});
```

Run with `pnpm test`. Coverage target: lines 60%+, branches 75%+.

## Recap

- **Engine layer** = pure `Blob → Blob` functions with `Record<string, any>` params (no `as unknown as` double assertion).
- **Capability declaration** = `name` / `inputTypes` / `outputTypes` / `params` (`CapabilityParam` 8 types) / `performance` / `batchable` / `mcpExposure`.
- **Plugin assembly** = `definePlugin(config, installer)` + `createBlobCapabilityImpl(options, ctx)` (5-step boilerplate encapsulated).
- **Stub detection** = `engine.version.includes('stub')` propagates to `CapabilityImplementation.status = 'stub'`, which the registry skips.
- **Permissions** = advisory in Alpha, enforced in Phase 2.

## Next steps

- [Architecture: Plugin layer](../architecture/plugin) — full `@lokvis/plugin-sdk` deep dive.
- [Custom Workspace](./custom-workspace) — invoke a capability without `<Workspace />`.
- [Plugin reference](../plugins) — `PluginContext` API overview.
