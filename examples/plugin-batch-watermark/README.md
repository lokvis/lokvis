# Example: plugin-batch-watermark

An N→1 **merge** teaching plugin that adds an `image.batch-watermark` capability to Lokvis. It stamps a text watermark onto each input image and then stitches all of them into a single contact sheet (grid layout). It is the merge-shape companion to [`plugin-grayscale`](../plugin-grayscale) (which is 1→1 / single), so together the two examples cover the first two of Lokvis's three Asset-flow shapes.

## What it teaches

- `createMergeCapabilityImpl(options, ctx)` — the factory for **N→1** capabilities (the counterpart of `createBlobCapabilityImpl` for 1→1 and `createSplitCapabilityImpl` for 1→N)
- The merge `operation` signature: `(blobs: Blob[], params) => Promise<Blob>` (a single output Blob from many inputs)
- Why `deriveMetadata` is **required** for merge (no single source → no sensible default metadata)
- `batchable: false` on the capability declaration — merge *is* the batch operation, so it must not be wrapped in another batch loop
- A realistic multi-step Blob→Blob pipeline (per-image watermark → grid stitching) implemented inline for readability

## The three Asset-flow shapes

| Shape | Factory | operation signature | Example capability | Example plugin |
|---|---|---|---|---|
| 1→1 (single) | `createBlobCapabilityImpl` | `(blob, params, signal) => Blob` | `image.grayscale` | `plugin-grayscale` |
| **N→1 (merge)** | **`createMergeCapabilityImpl`** | **`(blobs[], params) => Blob`** | **`image.batch-watermark`** | **this plugin** |
| 1→N (split) | `createSplitCapabilityImpl` | `(blob, params) => Blob[]` | `pdf.split` | (planned) |

## Files

```
examples/plugin-batch-watermark/
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── README.md           ← you are here
└── src/
    ├── index.ts        ← re-exports
    ├── plugin.ts       ← the whole plugin (definePlugin + operation + factory)
    └── __tests__/
        └── plugin.test.ts  ← tests (constants / installer / factory / execute / pure operation)
```

## The plugin in 30 seconds

```typescript
import { definePlugin, createMergeCapabilityImpl } from '@lokvis/plugin-sdk';
import type { Capability, PluginContext, AssetMetadata } from '@lokvis/schema';

const CAP: Capability = {
  name: 'image.batch-watermark',
  description: 'Stamp watermark + stitch into contact sheet (N→1)',
  inputTypes: ['image'],
  outputTypes: ['image'],
  params: [
    { name: 'text', type: 'string', required: false, default: '© Lokvis' },
    { name: 'position', type: 'enum', required: false, default: 'bottom-right',
      values: ['top-left','top-right','bottom-left','bottom-right','center'] },
    { name: 'columns', type: 'number', required: false },
    // ...
  ],
  performance: 'slow',
  batchable: false, // merge is itself the batch; don't wrap again
};

// N→1 operation (the only thing YOU write)
async function batchWatermark(blobs: Blob[], params: Record<string, unknown>) {
  const stamped = await Promise.all(blobs.map(b => stampWatermark(b, params)));
  return stitchContactSheet(stamped, params);
}

// merge has no single source → deriveMetadata is REQUIRED
function derive(outBlob: Blob): AssetMetadata {
  return { mimeType: outBlob.type, size: outBlob.size, format: 'png' };
}

export function batchWatermarkPlugin() {
  return definePlugin(
    { name: 'lokvis-example-batch-watermark', version: '0.1.0',
      capabilities: [CAP], engine: 'canvas-merge-teaching',
      permissions: ['asset:read', 'asset:write', 'network:none'] },
    (ctx) => {
      ctx.registerCapability(
        createMergeCapabilityImpl(
          { capability: 'image.batch-watermark', engine: 'canvas-merge-teaching',
            outputType: 'image', operation: batchWatermark,
            isStub: false, deriveMetadata: derive },
          ctx
        )
      );
    }
  );
}
```

## How to use it

```ts
import { createLokvis } from '@lokvis/sdk';
import { batchWatermarkPlugin } from '@lokvis/example-plugin-batch-watermark';

const lokvis = await createLokvis({
  plugins: [batchWatermarkPlugin()],
});

// Import several images, then merge them through one capability call
const ids = await Promise.all(files.map(f => lokvis.importAsset({ kind: 'file', file: f })));
const result = await lokvis.run(
  { /* workflow with one image.batch-watermark node, inputs: ids */ },
  ids
);
// result.outputs[0] is a single Asset — the contact sheet PNG
```

> **Browser only.** This plugin uses `createImageBitmap` + Canvas, so it runs in the browser Workspace but not in Node CLI (use `@lokvis/plugin-image/node` with sharp for Node-side image operations).

## Parameters

| Param | Type | Default | Description |
|---|---|---|---|
| `text` | string | `© Lokvis` | Watermark text stamped on every input image |
| `position` | enum | `bottom-right` | `top-left` / `top-right` / `bottom-left` / `bottom-right` / `center` |
| `fontSize` | number | `24` | Watermark font size in pixels |
| `opacity` | number | `0.6` | Watermark opacity (0–1) |
| `columns` | number | auto (`ceil(sqrt(n))`) | Contact sheet columns; auto-computed if omitted or `0` |
| `padding` | number | `8` | Padding (px) between thumbnails in the contact sheet |

## How it differs from `plugin-grayscale`

| Aspect | `plugin-grayscale` | This plugin |
|---|---|---|
| Asset-flow shape | 1→1 (single) | **N→1 (merge)** |
| Factory | `createBlobCapabilityImpl` | `createMergeCapabilityImpl` |
| `operation` signature | `(blob, params, signal) => Blob` | `(blobs[], params) => Blob` |
| `deriveMetadata` | Optional (defaults to propagating source dims) | **Required** (no single source) |
| `batchable` on capability | `true` (each input processed independently) | `false` (merge *is* the batch) |
| Output count | N (one per input) | 1 (always) |

**For production plugins**, follow the official pattern (as in `@lokvis/plugin-image`): put `Blob → Blob` operations in an `engine-*` package, and let the plugin only do Asset↔Blob glue via the SDK factories. This example inlines the operation for readability.

## Tests

```bash
pnpm --filter @lokvis/example-plugin-batch-watermark test
```

Tests cover (per AGENTS.md plugin test conventions): plugin constants, installer registration count, `buildBatchWatermarkCapabilityImplementations` return count, stub status (`stable`), execute empty-input error, execute N→1 happy path (verifies `getAssetBlob` called N times, `createAsset` called once), progress reporting, and pure `batchWatermark` operation behavior (empty input, single input, multi-input, default params, auto-column computation) via fake Canvas.
