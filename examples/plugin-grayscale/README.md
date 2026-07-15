# Example: plugin-grayscale

A minimal teaching plugin that adds an `image.grayscale` capability to Lokvis. It shows the complete anatomy of a plugin in ~200 lines so you can see every moving part on one screen.

## What it teaches

- `definePlugin(config, installer)` — declare plugin metadata + capabilities + the install function
- `createBlobCapabilityImpl(options, ctx)` — the factory that wraps your `Blob → Blob` operation into a `CapabilityImplementation` (handles Asset↔Blob conversion, metadata derivation, progress, abort)
- `Capability` — the declarative contract (`name` / `inputTypes` / `outputTypes` / `params` schema)
- Canvas pixel manipulation — decode → drawImage → getImageData → per-pixel grayscale → putImageData → encode

## Files

```
examples/plugin-grayscale/
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── README.md           ← you are here
└── src/
    ├── index.ts        ← re-exports
    ├── plugin.ts       ← the whole plugin (definePlugin + operation + factory)
    └── __tests__/
        └── plugin.test.ts  ← 13 tests (constants / installer / factory / execute / algorithms)
```

## The plugin in 30 seconds

```typescript
import { definePlugin, createBlobCapabilityImpl } from '@lokvis/plugin-sdk';
import type { Capability, PluginContext } from '@lokvis/schema';

const GRAYSCALE_CAPABILITY: Capability = {
  name: 'image.grayscale',
  description: 'Convert image to grayscale',
  inputTypes: ['image'],
  outputTypes: ['image'],
  params: [
    { name: 'algorithm', type: 'enum', required: false, default: 'luminance',
      values: ['luminance', 'average', 'lightness'] },
  ],
  performance: 'fast',
  batchable: true,
};

// Blob → Blob operation (the only thing YOU write)
async function grayscale(blob, params, signal) {
  const bitmap = await createImageBitmap(blob);
  // ... decode → per-pixel grayscale → encode ...
  return outputBlob;
}

export function grayscalePlugin() {
  return definePlugin(
    { name: 'lokvis-example-grayscale', version: '0.1.0',
      capabilities: [GRAYSCALE_CAPABILITY], engine: 'canvas-teaching',
      permissions: ['asset:read', 'asset:write', 'network:none'] },
    (ctx) => {
      const impl = createBlobCapabilityImpl(
        { capability: 'image.grayscale', engine: 'canvas-teaching',
          outputType: 'image', operation: grayscale, isStub: false },
        ctx
      );
      ctx.registerCapability(impl);
    }
  );
}
```

## How to use it

```ts
import { createLokvis } from '@lokvis/sdk';
import { grayscalePlugin } from '@lokvis/example-plugin-grayscale';

const lokvis = await createLokvis({
  plugins: [grayscalePlugin()],
});

// Now 'image.grayscale' is registered and callable from workflows
const assetId = await lokvis.importAsset({ kind: 'file', file });
const result = await lokvis.run(
  { /* workflow with image.grayscale node */ },
  [assetId]
);
```

> **Browser only.** This plugin uses `createImageBitmap` + Canvas, so it runs in the browser Workspace but not in Node CLI (use `@lokvis/plugin-image/node` with sharp for Node).

## Grayscale algorithms

| Algorithm | Formula | (255,0,0) red → gray |
|---|---|---|
| `luminance` (default) | `0.299R + 0.587G + 0.114B` (ITU-R BT.601, eye-weighted) | 76 |
| `average` | `(R + G + B) / 3` | 85 |
| `lightness` | `(max(R,G,B) + min(R,G,B)) / 2` (HSL lightness) | 128 |

## How it differs from the official @lokvis/plugin-image

| Aspect | This example | Official plugin |
|---|---|---|
| Blob→Blob operation | Inline in `plugin.ts` | Lives in `@lokvis/engine-image` (pure functions) |
| Layering | Self-contained (teaching) | Follows five-layer architecture (Plugin bridges Capability↔Engine) |
| Engines | Browser Canvas only | Browser Canvas + Node sharp |
| Capabilities | 1 (`image.grayscale`) | 9 (resize/compress/convert/crop/rotate/flip/watermark/background/filter) |

**For production plugins**, follow the official pattern: put `Blob → Blob` operations in an `engine-*` package, and let the plugin only do Asset↔Blob glue via `createBlobCapabilityImpl`. This example inlines the operation for readability.

## Tests

```bash
pnpm --filter @lokvis/example-plugin-grayscale test
```

13 tests cover (per AGENTS.md plugin test conventions): plugin constants, installer registration count, `buildGrayscaleCapabilityImplementations` return count, stub status (`stable`), execute empty-input error, execute happy path, and all three grayscale algorithms via fake Canvas.
