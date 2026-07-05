---
title: Write Your First Plugin
description: Add a custom capability to Lokvis using @lokvis/plugin-sdk.
draft: false
head: []
---

# Write Your First Plugin

Plugins are the only way to add capabilities to Lokvis. This guide shows you how to write a minimal plugin that registers one custom capability, install it into a Runtime, and call it from a workflow.

> Plugins use the **Alpha-preview** Plugin SDK. For exposing capabilities to AI clients (Claude / ChatGPT / Cursor), prefer the [MCP Server](../mcp) path. See [Plugins vs MCP](../plugins#plugin-sdk-vs-mcp-server) for the trade-off.

## What you will build

A `blur-image` plugin that registers the `image.blur` capability. It takes an image asset and returns a blurred copy using Canvas's `filter: blur(Npx)`.

```
image (Asset) ──► image.blur { radius: 8 } ──► blurred image (Asset)
```

## Prerequisites

- A bootstrapped Lokvis project (`pnpm install` at the monorepo root)
- Familiarity with the [five-layer architecture](../architecture) — plugins sit in the **Capability Layer** and bridge the Runtime ↔ Engine boundary

## 1. Scaffold the plugin package

Use the CLI scaffolder (preferred), or create the package manually:

```bash
lokvis plugin create blur-image
```

This generates a `@lokvis/blur-image` package with the standard layout:

```
packages/blur-image/
├── package.json
├── tsconfig.json
└── src/
    ├── index.ts
    └── plugin.ts
```

Manual layout — your `package.json` should look like:

```json
{
  "name": "@lokvis/blur-image",
  "version": "0.1.0",
  "type": "module",
  "main": "./src/index.ts",
  "dependencies": {
    "@lokvis/plugin-sdk": "workspace:*",
    "@lokvis/schema": "workspace:*"
  }
}
```

## 2. Declare the capability

A `Capability` is a declarative spec — name, input/output types, params, performance class. It says **what** the plugin can do, not **how**. The Runtime reads this spec to validate workflows, generate MCP manifests, and render param forms.

```typescript
// src/capabilities.ts
import type { Capability } from '@lokvis/schema';

export const BLUR_CAPABILITIES: Capability[] = [
  {
    name: 'image.blur',
    description: 'Apply a Gaussian blur to an image',
    inputTypes: ['image'],
    outputTypes: ['image'],
    params: [
      {
        name: 'radius',
        type: 'number',
        required: false,
        default: 4,
        min: 0,
        max: 50,
        description: 'Blur radius in pixels',
      },
    ],
    performance: 'fast',
    batchable: true,
  },
];
```

The `name` follows the `<domain>.<action>` convention. `image.*` capabilities are picked up by the image workflow templates and the command palette automatically.

## 3. Implement the engine operation

The actual pixel work lives in an **engine function**. Engine functions accept `Blob` + `Record<string, any>` and return `Blob` — they never see `Asset` or `Runtime`.

```typescript
// src/engine.ts

/**
 * Apply a Gaussian blur via Canvas filter.
 *
 * 注意:Engine 层操作函数签名统一为 (blob, params: Record<string, any>)。
 * 上游 plugin 层从 executor 收到的是 Record<string, unknown>,
 * 用 Record<string, any> 后内部单次 as 断言即可,无需 as unknown as 双断言。
 */
export async function blur(
  blob: Blob,
  params: Record<string, any>,
  signal?: AbortSignal
): Promise<Blob> {
  const radius = Number(params.radius ?? 4);
  if (radius <= 0) return blob;

  const bitmap = await createImageBitmap(blob);
  try {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const ctx = canvas.getContext('2d')!;
    ctx.filter = `blur(${radius}px)`;
    ctx.drawImage(bitmap, 0, 0);

    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    return await canvas.convertToBlob({ type: blob.type || 'image/png' });
  } finally {
    bitmap.close();
  }
}
```

## 4. Wire it up with `definePlugin`

`definePlugin(config, installer)` returns a plugin object. The `installer` runs once when the Runtime loads the plugin — it receives a `PluginContext` and registers capability implementations.

```typescript
// src/plugin.ts
import { definePlugin, createBlobCapabilityImpl } from '@lokvis/plugin-sdk';
import { BLUR_CAPABILITIES } from './capabilities.js';
import { blur } from './engine.js';

export const PLUGIN_NAME = 'lokvis-blur-image';
export const PLUGIN_VERSION = '0.1.0';
export const PLUGIN_ENGINE = 'canvas-blur';

export function blurImagePlugin() {
  return definePlugin(
    {
      name: PLUGIN_NAME,
      version: PLUGIN_VERSION,
      description: 'Gaussian blur for images (Canvas-based)',
      capabilities: BLUR_CAPABILITIES,
      engine: PLUGIN_ENGINE,
      permissions: ['asset:read', 'asset:write', 'network:none'],
    },
    (ctx) => {
      // createBlobCapabilityImpl 封装了「取 blob → 调 operation → 派生 metadata
      // → createAsset → 进度/取消」五步样板,适用于单输入→单输出的 Blob 操作。
      const impl = createBlobCapabilityImpl(
        {
          capability: 'image.blur',
          engine: PLUGIN_ENGINE,
          outputType: 'image',
          operation: blur,
          isStub: false,
        },
        ctx
      );
      ctx.registerCapability(impl);
      ctx.log('info', 'Registered image.blur capability');
    }
  );
}
```

```typescript
// src/index.ts
export { blurImagePlugin as default, blurImagePlugin } from './plugin.js';
export { blur } from './engine.js';
```

## 5. Load it into a Runtime

```typescript
import { createLokvis } from '@lokvis/sdk';
import { imageToolsPlugin } from '@lokvis/plugin-image';
import blurImagePlugin from '@lokvis/blur-image';

const lokvis = await createLokvis({
  plugins: [imageToolsPlugin(), blurImagePlugin()],
});

const caps = await lokvis.capabilities();
console.log(caps.find((c) => c.name === 'image.blur'));
// { name: 'image.blur', description: '...', inputTypes: ['image'], ... }
```

You can also load it dynamically into an already-created Runtime:

```typescript
import { loadPlugin } from '@lokvis/sdk';
await loadPlugin(lokvis, blurImagePlugin());
```

## 6. Call it from a workflow

```typescript
import type { Workflow } from '@lokvis/schema';

const workflow: Workflow = {
  id: 'blur-demo',
  version: '1.0.0',
  name: 'Blur Demo',
  category: 'image',
  nodes: [
    { id: 'n-load', type: 'load', capability: 'asset.load' },
    {
      id: 'n-blur',
      type: 'transform',
      capability: 'image.blur',
      params: { radius: 8 },
      label: 'Blur',
    },
    { id: 'n-export', type: 'export', capability: 'asset.export' },
  ],
  edges: [
    { from: 'n-load', to: 'n-blur' },
    { from: 'n-blur', to: 'n-export' },
  ],
  inputs: { type: 'image', multiple: false, accept: ['image/*'] },
  outputs: { type: 'image', format: 'png' },
};

const assetId = await lokvis.importAsset({ kind: 'file', file });
const result = await lokvis.run(workflow, [assetId]);
const blurredBlob = await lokvis.exportAsset(result.outputs[0]!);
```

## PluginContext API cheat sheet

The installer's `ctx` is a **restricted** view of the Runtime — plugins never get the full `LokvisRuntime`. Available members:

| Member | Purpose |
|--------|---------|
| `ctx.runtime.getAsset(id)` | Read asset metadata |
| `ctx.runtime.getAssetBlob(asset)` | Read asset blob bytes |
| `ctx.runtime.createAsset(blob, metadata, type)` | Persist a new asset (returns `Asset`) |
| `ctx.runtime.listCapabilities()` | Inspect other registered capabilities |
| `ctx.registerCapability(impl)` | Register a `CapabilityImplementation` |
| `ctx.registerMetadataReader(name, fn)` | Register a `MetadataReader` (e.g. EXIF) |
| `ctx.registerPanel(panel)` | Register a custom UI panel |
| `ctx.eventBus` | Emit/listen to Runtime events |
| `ctx.log(level, message)` | Structured logging |

## Stub engines

If your engine is a placeholder (e.g. video/PDF before ffmpeg.wasm / pdf-lib is wired up):

1. Set `version` to include the literal `'stub'` token (e.g. `'0.1.0-stub'`)
2. Make every operation throw `new Error('xxx not implemented in stub')`
3. Pass `isStub: true` to `createBlobCapabilityImpl`

The Runtime detects stub implementations and skips them in `CapabilityRegistry.resolve()` — workflows that reference stub-only capabilities fail fast with `CAPABILITY_STUB_ONLY` instead of crashing mid-execution.

## Permissions

Declare the least-privilege permission set in the plugin config:

```typescript
permissions: ['asset:read', 'asset:write', 'network:none']
```

- `asset:read` / `asset:write` — required to call `getAssetBlob` / `createAsset`
- `network:none` — explicitly disallow network access (the default for image tools)
- `network:fetch` — required if your engine calls `fetch()` (e.g. watermark image download)

Permissions are advisory in the Alpha — the Runtime does not yet enforce them at the boundary. Phase 2 will add hard enforcement.

## Testing

Drop a Vitest spec under `src/__tests__/plugin.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { blurImagePlugin } from '../plugin.js';

describe('blurImagePlugin', () => {
  it('声明 image.blur 能力', () => {
    const plugin = blurImagePlugin();
    expect(plugin.config.name).toBe('lokvis-blur-image');
    expect(plugin.config.capabilities).toHaveLength(1);
    expect(plugin.config.capabilities[0]!.name).toBe('image.blur');
  });
});
```

Browser-only APIs (`OffscreenCanvas`, `createImageBitmap`) need fakes — see the [test conventions](https://github.com/lokvis/lokvis/blob/dev/AGENTS.md#测试约定) in `AGENTS.md`.

## Next steps

- [Plugin reference](../plugins) — full PluginContext API and the official plugin list
- [Custom Workspace](./custom-workspace) — build a UI without `<Workspace />`
- [Architecture](../architecture) — why Plugin is the Capability ↔ Engine bridge
