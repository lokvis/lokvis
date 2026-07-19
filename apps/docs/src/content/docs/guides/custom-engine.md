---
title: Register a Custom Image Engine
description: Implement the ImageEngineAdapter interface and register it alongside the default canvas engine — for Squoosh WASM, WebCodecs, or any custom image processing backend.
draft: false
head: []
---

# Register a Custom Image Engine

The image engine layer is swappable. The default `canvasEngine` uses browser-native `createImageBitmap` + `Canvas 2D` + `canvas.toBlob` — zero WASM dependency, fastest first paint, covers ~80% of image operations. When you need better encoding quality (AVIF, high-quality WebP) or a non-browser backend (Node.js + sharp, Squoosh WASM, WebCodecs), implement the `ImageEngineAdapter` interface and register it.

## When to write a custom engine

| Use case | Default `canvasEngine` enough? | Custom engine needed? |
|---|---|---|
| Resize / compress / convert PNG/JPEG/WebP | ✅ | — |
| High-quality AVIF encoding | ⚠️ (browser support varies) | Squoosh WASM |
| Streaming / tile-based processing for >500MB images | ❌ | Implement `StreamingImageEngineAdapter` |
| Node.js CLI / server-side | ❌ (no `OffscreenCanvas`) | sharp-based adapter |
| Hardware-accelerated video-frame capture | ❌ | WebCodecs adapter |
| Custom image filters / effects | ✅ (via `image.filter`) | — |

If you only need a new **capability** (e.g. blur, gamma, AI background removal), write a [plugin](./write-first-plugin) instead — you don't need a new engine.

## The `ImageEngineAdapter` interface

Defined in [`packages/engine-image/src/types.ts`](https://github.com/lokvis/lokvis/blob/main/packages/engine-image/src/types.ts):

```typescript
export type ImageEngineName = 'canvas' | 'squoosh' | 'webcodecs' | 'imagemagick';

export interface ImageEngineAdapter {
  /** Engine identifier (must be one of the union values) */
  name: ImageEngineName;
  /** Semantic version, e.g. '1.0.0'. Append '-stub' for stub engines. */
  version: string;
  /** Capabilities this engine can execute, e.g. ['image.resize', 'image.compress'] */
  supportedCapabilities: string[];

  /** Runtime feature detection (called once during registry selection) */
  isSupported(): Promise<boolean>;
  /** Optional one-time initialization (load WASM, warm up worker, etc.) */
  initialize?(): Promise<void>;
  /** Optional cleanup (terminate worker, free WASM memory, etc.) */
  dispose?(): Promise<void>;

  // ─── Decode / Encode primitives ───
  /** Decode a Blob into an ImageBitmap + dimensions */
  decode(blob: Blob): Promise<DecodedImage>;
  /** Encode a canvas to a Blob in the target format */
  encode(
    canvas: HTMLCanvasElement | OffscreenCanvas,
    format: ImageOutputFormat,
    quality?: number
  ): Promise<Blob>;
}
```

The interface is intentionally minimal: **decode** a Blob into a bitmap, **encode** a canvas into a Blob. Higher-level operations (`resize`, `compress`, `convert`, `crop`, `rotate`, `flip`, `watermark`, `background`, `filter`) are implemented in `packages/engine-image/src/operations/` as functions that call `decode` → manipulate → `encode`. Your custom engine only needs to provide the two primitives.

For streaming / tile-based processing (large images), implement `StreamingImageEngineAdapter` instead, which adds `decodeRegion` and `mergeChunks` methods.

## Registration API

`registerImageEngine` is exported from `@lokvis/engine-image`:

```typescript
import { registerImageEngine, getEngine, listEngines, selectBestEngine } from '@lokvis/engine-image';
```

| Function | Description |
|---|---|
| `registerImageEngine(engine)` | Add an engine to the registry |
| `getEngine(name?)` | Get a specific engine (falls back to `canvasEngine` if not found) |
| `listEngines()` | List all registered engines |
| `selectBestEngine()` | Pick the first supported engine in registration order |

The registry initializes with `canvasEngine` pre-registered and set as both default and fallback. Calling `registerImageEngine(yourEngine)` adds yours to the list — the runtime's `selectBestEngine()` will pick the first one whose `isSupported()` returns `true`.

## Minimal example: stub Squoosh engine

This example shows the full structure without requiring actual WASM modules. Replace the `decode` / `encode` bodies with real Squoosh calls when ready.

```typescript
// my-app/engines/squoosh-engine.ts
import type {
  ImageEngineAdapter,
  DecodedImage,
  ImageOutputFormat,
} from '@lokvis/engine-image';
// import { SquooshModule } from '@squoosh/wasm';  // hypothetical

export const squooshEngine: ImageEngineAdapter = {
  name: 'squoosh',
  version: '0.1.0',
  supportedCapabilities: [
    'image.resize',
    'image.compress',
    'image.convert',
    'image.crop',
    'image.rotate',
    'image.flip',
    'image.watermark',
    'image.background',
    'image.filter',
  ],

  async isSupported() {
    // Squoosh needs WASM + WebAssembly.instantiateStreaming
    return typeof WebAssembly !== 'undefined' && typeof createImageBitmap !== 'undefined';
  },

  async initialize() {
    // Pre-load the WASM module so the first operation doesn't pay the fetch cost.
    // Cache the module instance on a closure variable.
    // this._module = await SquooshModule.load();
  },

  async dispose() {
    // Free WASM memory.
    // this._module?.free();
  },

  async decode(blob: Blob): Promise<DecodedImage> {
    const bitmap = await createImageBitmap(blob);
    return {
      bitmap,
      width: bitmap.width,
      height: bitmap.height,
    };
  },

  async encode(
    canvas: HTMLCanvasElement | OffscreenCanvas,
    format: ImageOutputFormat,
    quality?: number
  ): Promise<Blob> {
    // Use Squoosh's encoder for AVIF / high-quality WebP.
    // For PNG / JPEG / GIF, fall back to canvas.toBlob (browser-native is fine).
    if (format === 'avif' || (format === 'webp' && (quality ?? 80) > 85)) {
      // const bitmap = await createImageBitmap(canvas);
      // return this._module.encode(bitmap, format, quality);
      throw new Error('Squoosh encode not implemented in this stub');
    }
    // Fall back to canvas-native encoding for basic formats
    return new Promise((resolve, reject) => {
      const offscreen = canvas as OffscreenCanvas;
      offscreen.convertToBlob({ type: `image/${format}`, quality: quality ? quality / 100 : undefined })
        .then(resolve, reject);
    });
  },
};
```

## Registering the engine

Call `registerImageEngine` once during app initialization, **before** any image operation runs. A good place is right after `createLokvis()` but before mounting components:

```typescript
import { createLokvis } from '@lokvis/sdk';
import { imageToolsPlugin } from '@lokvis/plugin-image';
import { registerImageEngine } from '@lokvis/engine-image';
import { squooshEngine } from './engines/squoosh-engine';

async function initApp() {
  // 1. Register your engine BEFORE creating the runtime
  registerImageEngine(squooshEngine);

  // 2. Create the runtime (imageToolsPlugin will use the registered engine)
  const runtime = await createLokvis({
    plugins: [imageToolsPlugin()],
  });

  // 3. Mount your UI
  // ...
}
```

### Engine selection order

`selectBestEngine()` iterates engines in registration order and returns the first one whose `isSupported()` resolves to `true`:

1. `canvasEngine` (pre-registered, always supported in browsers)
2. Any engine you `registerImageEngine()` afterwards

To make your engine preferred, you have two options:

**Option A** — Register before any operation runs. Since `canvasEngine` is always supported, it will always win. To override, you need to manipulate the registry directly (currently no public API for this — see [§Limitations](#limitations)).

**Option B** — Make your `canvasEngine.isSupported()` return `false` in environments where you want your engine to win. This is a workaround; a proper priority API is planned.

## Stub engines

If you're developing a new engine but haven't implemented all operations yet, mark it as a stub:

```typescript
export const myEngine: ImageEngineAdapter = {
  name: 'squoosh',
  version: '0.1.0-stub',  // ← 'stub' suffix triggers stub handling
  supportedCapabilities: ['image.resize'],
  // ...
};
```

Per [`AGENTS.md`](https://github.com/lokvis/lokvis/blob/main/AGENTS.md), when the engine adapter version contains `'stub'`:

- The plugin layer (`buildImageCapabilityImplementations`) sets `CapabilityImplementation.status = 'stub'`
- `CapabilityRegistry.resolve()` skips stub implementations
- The executor gives a clear error if only stub implementations are available

This lets you ship an engine skeleton without breaking the runtime — non-stub engines take priority.

## Streaming engine (large images)

For images >500MB that can't fit in memory as a single decoded bitmap, implement `StreamingImageEngineAdapter`:

```typescript
import type { StreamingImageEngineAdapter, ImageTile, ImageChunk } from '@lokvis/engine-image';

export const myStreamingEngine: StreamingImageEngineAdapter = {
  name: 'squoosh',
  version: '1.0.0',
  supportedCapabilities: ['image.resize', 'image.compress'],

  async isSupported() { /* ... */ },
  async decode(blob: Blob) { /* ... */ },
  async encode(canvas, format, quality) { /* ... */ },

  // Streaming-specific:
  async decodeRegion(blob: Blob, tile: ImageTile) {
    // Decode only the specified region, not the whole image
  },
  async mergeChunks(chunks: ImageChunk[], totalWidth, totalHeight, format, quality) {
    // Stitch encoded chunks back into a single output Blob
  },
};
```

The runtime automatically uses `decodeRegion` for tile-based processing when available, falling back to full-image `decode` for non-streaming engines.

## Node.js engine (server-side)

For server-side processing (CLI, MCP server, CI scripts), the same `ImageEngineAdapter` interface works — but you'll need a Node-compatible decode/encode implementation. The `@lokvis/engine-image/node` subpath provides a `sharp`-based adapter that swaps `createImageBitmap` for sharp's buffer API.

```typescript
// In a Node.js context (CLI / MCP server)
import { registerImageEngine } from '@lokvis/engine-image/node';
import { sharpEngine } from '@lokvis/engine-image/node';
// (sharpEngine is hypothetical — not yet implemented as of Alpha)

registerImageEngine(sharpEngine);
```

> **Note:** The Node.js sharp engine is not yet implemented. Today the CLI uses the same canvas engine in a Node.js Worker with `OffscreenCanvas` polyfill. See the [CLI Automation guide](./cli-automation) for current usage.

## Testing your engine

Use the existing engine test pattern (`packages/engine-image/src/__tests__/canvas-engine.test.ts`):

```typescript
import { describe, it, expect } from 'vitest';
import { squooshEngine } from '../engines/squoosh-engine';

describe('squoosh engine', () => {
  it('declares supported capabilities', () => {
    expect(squooshEngine.supportedCapabilities).toContain('image.resize');
  });

  it('passes isSupported in a browser environment', async () => {
    expect(await squooshEngine.isSupported()).toBe(true);
  });

  it('decodes a PNG blob', async () => {
    const blob = new Blob([/* PNG bytes */], { type: 'image/png' });
    const decoded = await squooshEngine.decode(blob);
    expect(decoded.width).toBeGreaterThan(0);
  });

  it('encodes to WebP', async () => {
    const canvas = new OffscreenCanvas(100, 100);
    const blob = await squooshEngine.encode(canvas, 'webp', 80);
    expect(blob.type).toBe('image/webp');
  });
});
```

## Limitations

- **No priority field**: the registry selects the first supported engine in registration order. `canvasEngine` is always pre-registered, so it always wins. To override, you currently need to manipulate the registry internals (no public API). A `priority` field or `setPreferredEngine(name)` is planned.
- **No runtime swap**: once an engine is selected, switching to another requires reinitializing the runtime. Hot-swapping is not supported.
- **No streaming for canvasEngine**: the default canvas engine implements `ImageEngineAdapter` but not `StreamingImageEngineAdapter`. Tile-based processing is approximated via `createImageBitmap` resize options but not truly streaming.
- **Stub-only fallback**: if only stub engines are registered for a capability, the runtime throws `CapabilityStubOnlyError`. Make sure at least one non-stub engine supports each capability you want to use.

## Reference

- [`packages/engine-image/src/types.ts`](https://github.com/lokvis/lokvis/blob/main/packages/engine-image/src/types.ts) — `ImageEngineAdapter` interface, params types
- [`packages/engine-image/src/adapter.ts`](https://github.com/lokvis/lokvis/blob/main/packages/engine-image/src/adapter.ts) — registry + `registerImageEngine`
- [`packages/engine-image/src/canvas-engine.ts`](https://github.com/lokvis/lokvis/blob/main/packages/engine-image/src/canvas-engine.ts) — reference implementation
- [Architecture: Engine](../architecture/engine) — engine layer overview
- [API Reference: engine-image](../../api/engine-image) — full TypeDoc
