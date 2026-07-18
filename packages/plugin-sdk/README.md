# @lokvis/plugin-sdk

> Build Lokvis plugins — register capabilities, wrap engine operations, extend the workspace.

## Status: Beta

Plugin SDK is in **Beta** (`0.4.0`). The API surface (`definePlugin`, the three
capability factories `createBlobCapabilityImpl` / `createMergeCapabilityImpl` /
`createSplitCapabilityImpl`, `PluginContext`) is stable and covered by tests.
The permission model is **enforced** as of W18.6 (`network:none` blocks
`fetch`/`XHR`/`WebSocket`/`EventSource` via runtime sandbox; `filesystem` is
asserted at API boundaries). The `plugin create` scaffolder is available via
`@lokvis/cli`. See [Architecture → Plugin SDK](https://lokvis.dev/architecture/plugin)
for the full deep dive.

**What "Beta" means here:**
- API is stable; we avoid breaking changes within the `0.4.x` line.
- 2 example plugins ship (`plugin-grayscale` for single 1→1, `plugin-batch-watermark`
  for merge N→1 + multi-step workflow).
- `plugin create <name>` generates a publish-ready skeleton.
- GA (`1.0`) is deferred to Phase 3 pending ecosystem validation.

> **AI integration?** If your goal is to let an AI client call local capabilities,
> use [`@lokvis/mcp-server`](../mcp-server) (MCP standard) instead of Plugin SDK.

## Install

```bash
npm install @lokvis/plugin-sdk @lokvis/schema
```

`@lokvis/schema` is a peer dependency (type-only).

## Quick start

```typescript
import { definePlugin, createBlobCapabilityImpl } from '@lokvis/plugin-sdk';
import type { Capability } from '@lokvis/schema';

const grayscaleCapability: Capability = {
  name: 'image.grayscale',
  description: 'Convert image to grayscale',
  inputTypes: ['image'],
  outputTypes: ['image'],
  params: [],
  performance: 'fast',
};

async function grayscaleOperation(blob: Blob): Promise<Blob> {
  // Your Blob→Blob transform (Canvas, sharp, WASM, etc.)
  // ...
  return blob;
}

export default definePlugin(
  {
    name: 'my-grayscale-plugin',
    version: '1.0.0',
    capabilities: [grayscaleCapability],
    engine: 'canvas',
    permissions: ['asset:read', 'asset:write', 'network:none'],
  },
  (ctx) => {
    const isStub = false; // set true if engine is a stub
    ctx.registerCapability(
      createBlobCapabilityImpl(
        {
          capability: 'image.grayscale',
          engine: 'canvas',
          outputType: 'image',
          operation: grayscaleOperation,
          isStub,
        },
        ctx
      )
    );
  }
);
```

Load it via `createLokvis({ plugins: [yourPlugin] })` or `loadPlugin(runtime, yourPlugin)`.

## API reference

### `definePlugin(config, installer?)`

Build a `{ config, install }` plugin object.

| Parameter | Type | Description |
|-----------|------|-------------|
| `config` | `PluginConfig` | Plugin manifest (name, version, capabilities, engine, permissions) |
| `installer?` | `(ctx: PluginContext) => void \| Promise<void>` | Setup function called by Runtime at load time |

### Capability factories

Three factories cover the three Asset-flow shapes:

| Factory | Shape | Use case |
|---------|-------|----------|
| `createBlobCapabilityImpl(options, ctx)` | 1→1 (single) | resize, compress, grayscale |
| `createMergeCapabilityImpl(options, ctx)` | N→1 (merge) | pdf.merge, image.stitch |
| `createSplitCapabilityImpl(options, ctx)` | 1→N (split) | pdf.split, video.extract-frames |

Each factory:
- Wraps your `operation` function (Blob→Blob) with Asset↔Blob conversion boilerplate
- Sets `status: 'stub' | 'stable'` from `options.isStub` (detect via `engine.version.includes('stub')`)
- Handles progress reporting (`onProgress`) and cancellation (`AbortSignal`)

#### Options interface (Blob)

```typescript
interface BlobCapabilityOptions {
  capability: string;       // e.g. 'image.resize'
  engine: string;           // e.g. 'sharp'
  outputType: AssetType;     // e.g. 'image'
  operation: (blob: Blob, params: Record<string, unknown>, signal?: AbortSignal) => Promise<Blob>;
  isStub: boolean;           // engine.version.includes('stub')
  deriveMetadata?: (source: Asset, outBlob: Blob) => AssetMetadata;  // optional
}
```

Merge/Split factories require `deriveMetadata` (no sensible default for multi-output).

### `createCapabilityImpl(capability, engine, execute)`

Low-level factory for inline builtin implementations. Sets `status: 'stable'`.
Prefer the Blob/Merge/Split factories for engine-backed plugins.

### `definePanel(panel)`

Passthrough factory for `PanelDefinition` (UI extension point).

### `defaultDeriveOutputMetadata(source, outBlob)`

Default metadata derivation: propagates `dimensions` from source, takes
`mimeType`/`size`/`format` from output Blob.

## PluginContext API

The `ctx` object passed to your `installer` function:

| Field | Type | Description |
|-------|------|-------------|
| `ctx.runtime.getAsset(id)` | `Promise<Asset>` | Read asset metadata |
| `ctx.runtime.importAsset(file)` | `Promise<string>` | Import File/Blob, return AssetId |
| `ctx.runtime.getAssetBlob(asset)` | `Promise<Blob>` | Get raw Blob for processing |
| `ctx.runtime.createAsset(blob, meta, type)` | `Promise<Asset>` | Create output asset |
| `ctx.runtime.listCapabilities()` | `Promise<Capability[]>` | List registered capabilities |
| `ctx.eventBus` | `EventBus` | Subscribe to runtime events |
| `ctx.registerCapability(impl)` | `void` | Register a CapabilityImplementation |
| `ctx.registerMetadataReader(name, reader)` | `void` | Register a metadata query function (e.g. EXIF reader) |
| `ctx.registerPanel(panel)` | `void` | Register a UI Panel |
| `ctx.sandbox` | `PluginPermissionSandbox` | Permission self-check (W18.6) |
| `ctx.log(level, message)` | `void` | Structured logging |

### Permission sandbox (W18.6)

```typescript
ctx.sandbox.assertNetworkAllowed('loading model manifest');
ctx.sandbox.assertFilesystemAllowed('opfs', 'writing cache');
```

If your plugin declared `network:none`, `assertNetworkAllowed` throws
`PluginPermissionError`. The Runtime also monkey-patches `fetch`/`XHR`/
`WebSocket`/`EventSource` during `install()` as a best-effort guard.

## Plugin lifecycle

```
createLokvis({ plugins })
  → installPlugin(plugin)
    → registerCapability declarations
    → createPluginContext (sandbox + restricted Runtime API)
    → applyNetworkGuard (if network:none)
    → plugin.install(ctx)   ← your installer runs here
    → restore network guard
    → emit 'plugin:loaded' event
```

On failure, `installPlugin()` throws `PluginLoadError` (wrapped by SDK as
`LokvisError` with `code: 'PLUGIN_LOAD_FAILED'`).

## Stub engine handling

If your engine is a placeholder (version contains `'stub'`):

1. Pass `isStub: true` to the capability factory → `status: 'stub'`
2. `CapabilityRegistry.resolve()` skips stub implementations
3. `Executor` throws `CapabilityStubOnlyError` if only stubs exist
4. `runtime.capabilities()` still lists the capability (so users see what's coming)

## Types re-exported

All types from `@lokvis/schema` are re-exported:
`Asset`, `AssetMetadata`, `AssetType`, `Capability`, `CapabilityImplementation`,
`ExecutionContext`, `PluginConfig`, `PluginContext`, `PluginInstaller`,
`PluginPermission`, `PanelDefinition`

## Scaffolding a new plugin

The `@lokvis/cli` package ships a `plugin create` command that generates a
publish-ready skeleton (package.json / tsconfig / src/index.ts / README) with
the correct dependency on `@lokvis/plugin-sdk` + `@lokvis/schema`:

```bash
# In the lokvis monorepo
pnpm --filter @lokvis/cli exec lokvis plugin create my-plugin

# Or with a scoped name
pnpm --filter @lokvis/cli exec lokvis plugin create @my-org/lokvis-plugin-my-tool
```

The generated `src/index.ts` shows the full `definePlugin` + `createBlobCapabilityImpl`
pattern. See `examples/plugin-grayscale` and `examples/plugin-batch-watermark` for
two complete, tested reference plugins covering the 1→1 and N→1 capability shapes.

## Further reading

- [Architecture → Plugin SDK](https://lokvis.dev/architecture/plugin) — full deep dive
- [Guide → Write Your First Plugin](https://lokvis.dev/guides/write-first-plugin) — tutorial
- [Example: plugin-grayscale](../../examples/plugin-grayscale) — teaching reference (1→1 / single)
- [Example: plugin-batch-watermark](../../examples/plugin-batch-watermark) — teaching reference (N→1 / merge + multi-step)
