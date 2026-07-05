---
title: Engine Layer (Deep Dive)
description: The Blob↔Blob pure-function contract that backs every image operation.
draft: false
head: []
---

# Engine Layer (Deep Dive)

The Engine Layer is where actual pixels get processed. An engine is a **pure adapter** over a decoding/encoding backend — it accepts a `Blob`, returns a `Blob`, and never sees `Asset`, `Runtime`, or `Workflow`. This purity is what lets engines be swapped (Canvas today, Squoosh WASM tomorrow) without touching any other layer.

This page documents [`@lokvis/engine-image`](https://github.com/lokvis/lokvis/tree/dev/packages/engine-image/src), the only engine shipped in Phase 1.

## Module map

```
packages/engine-image/src/
├── types.ts               ← ImageEngineAdapter contract + param types + streaming types
├── canvas-engine.ts       ← Canvas adapter (decode/encode/isSupported)
├── adapter.ts             ← Engine registry: registerImageEngine / getEngine / selectBestEngine
├── worker-adapter.ts      ← Worker-side entry: startImageWorker + dispatchImageMethod
└── operations/
    ├── index.ts           ← Re-exports
    ├── transform.ts       ← resize / crop / rotate / flip
    ├── encode.ts          ← convert / reencode / inferFormat
    ├── compress-target.ts ← compressToTargetSize (binary search)
    ├── watermark.ts       ← text/image watermark + position compute
    ├── filters.ts         ← grayscale / invert / sepia / blur (CSS filter)
    ├── png-metadata.ts    ← PNG pHYs chunk read/write (DPI)
    ├── tiles.ts           ← splitIntoTiles / mergeChunks / isDownscale
    └── utils.ts           ← createCanvas / get2DContext / throwIfAborted
```

## The `ImageEngineAdapter` contract

```typescript
export interface ImageEngineAdapter {
  name: ImageEngineName;        // 'canvas' | 'squoosh' | 'webcodecs' | 'imagemagick'
  version: string;              // '0.1.0' (or '0.1.0-stub' for placeholders)
  supportedCapabilities: string[];
  isSupported(): Promise<boolean>;
  initialize?(): Promise<void>;
  dispose?(): Promise<void>;

  decode(blob: Blob): Promise<DecodedImage>;
  encode(canvas, format, quality?): Promise<Blob>;
}
```

Every engine must implement `decode` + `encode`. The actual transforms (`resize`, `compress`, `rotate`, ...) are **operation functions** that take a `Blob` + params, internally call `decode` → draw on a canvas → `encode`, and return the output `Blob`.

## Operation function signature

```typescript
export async function resize(
  blob: Blob,
  params: Record<string, any>,
  signal?: AbortSignal
): Promise<Blob>
```

Per `AGENTS.md`, engine operations accept `Record<string, any>` — not a specific interface like `ResizeParams`. This is intentional: the Plugin layer receives `Record<string, unknown>` from the executor, and TypeScript does not allow direct conversion between an interface and `Record<string, unknown>`. Using `Record<string, any>` means the Plugin layer can pass params through with a single `as` assertion (or no assertion at all) — no `as unknown as` double assertion.

The `signal?: AbortSignal` parameter is part of every operation. Operations call `throwIfAborted(signal)` at decode / draw / encode boundaries so `cancel()` actually halts in-flight work, not just sets a flag.

## Canvas engine implementation

The Phase 1 engine uses native browser APIs:

- **Decode**: `createImageBitmap(blob)` — zero dependencies, GPU-accelerated where available
- **Draw**: `OffscreenCanvas` + `CanvasRenderingContext2D` (in the worker) or `HTMLCanvasElement` (in tests)
- **Encode**: `canvas.convertToBlob({ type, quality })`
- **Resize optimization**: `createImageBitmap(blob, { resizeWidth, resizeHeight })` decodes-and-scales in one step, avoiding the memory spike of "decode full-res then scale". Browsers without this option auto-fall back to plain decode.

```typescript
export const canvasEngine: ImageEngineAdapter = {
  name: 'canvas',
  version: CANVAS_ENGINE_VERSION, // '0.1.0'
  supportedCapabilities: ['image.resize', 'image.compress', /* ... 9 total */],
  async isSupported() {
    return typeof OffscreenCanvas !== 'undefined' && typeof createImageBitmap !== 'undefined';
  },
  async decode(blob) { /* createImageBitmap + return {bitmap, width, height} */ },
  async encode(canvas, format, quality) { /* canvas.convertToBlob */ },
};
```

`adapter.ts` keeps a `Map<ImageEngineName, ImageEngineAdapter>` and registers `canvasEngine` by default. Future engines call `registerImageEngine(squooshEngine)` to register themselves; `selectBestEngine()` returns the first supported one (Canvas preferred for MVP).

## Streaming types (for future WASM)

Canvas cannot truly stream — `createImageBitmap` decodes the whole image at once. But the type contract is in place for future WASM engines (Squoosh / WebCodecs) that can decode row-by-row:

```typescript
export interface ImageTile {
  x: number; y: number; width: number; height: number;
}

export interface ImageChunk {
  tile: ImageTile;
  blob: Blob;
}

export interface StreamingImageOperation {
  (input: ReadableStream<Blob>, params, signal?): AsyncIterable<ImageChunk>;
}

export interface StreamingImageEngineAdapter extends ImageEngineAdapter {
  decodeRegion?(blob: Blob, tile: ImageTile): Promise<DecodedImage>;
  mergeChunks?(chunks, totalW, totalH, format, quality?): Promise<Blob>;
}
```

The Canvas engine approximates streaming via `splitIntoTiles(width, height, tileSize=512)` (pure function, row-major grid) + `mergeChunks(chunks, ...)` (decode → drawImage → encode). This lets the Memory Guard spill intermediate chunks to OPFS instead of holding the whole decoded bitmap in memory.

## Worker integration

Image operations run in a dedicated Web Worker to keep the main thread responsive. The worker-side wiring lives in `worker-adapter.ts`:

```
Host (main thread)
  ├─ WorkerHost.postMessage({type:'request', id, method, params})
  └─ WorkerHost listens for {type:'response', id, ...} / {type:'event', ...} / {type:'pong'}

Worker (engine-image)
  ├─ startImageWorker() — handshake, register handlers
  ├─ Maintains Map<id, AbortController> for in-flight ops
  ├─ dispatchImageMethod(method, params, signal) — calls the operation function
  └─ createImageWorkerHandler() — pure handler factory (testable)
```

The worker only depends on `@lokvis/schema` (for message types). It does **not** import `@lokvis/runtime` — the protocol is one-way (host calls, worker responds). Method names align with capabilities: `image.resize` / `image.compress` / etc.

When the host sends a `{type:'cancel', id}` message, the worker looks up the matching `AbortController` and calls `abort()` — the in-flight operation throws `DOMException('AbortError')` at its next `throwIfAborted()` check, and the worker sends back a `{type:'response', id, error: 'AbortError'}`.

## PNG DPI metadata

`png-metadata.ts` reads and writes the PNG `pHYs` chunk (physical pixel dimensions). This is how the Resize tool's DPI input (72 / 150 / 300) gets embedded into PNG exports — print software reads `pHYs` to compute physical print size. Non-PNG formats ignore DPI (JPG/WebP have no equivalent chunk that print pipelines respect).

- `readPngDpi(blob): Promise<number | null>` — scan chunks for `pHYs`, return pixels-per-meter
- `embedPngDpi(blob, dpi): Promise<Blob>` — copy the PNG, inject a `pHYs` chunk after `IHDR`

## Stub engines (Phase 2 placeholder pattern)

For domains that have no Phase 1 engine (video / pdf / audio), `engine-image` ships stub adapters whose `version` includes the literal string `'stub'`:

```typescript
const stubEngine: ImageEngineAdapter = {
  name: 'ffmpeg',
  version: '0.1.0-stub',     // ← the 'stub' token
  supportedCapabilities: ['video.transcode', /* ... */],
  async isSupported() { return false; },
  async decode() { throw new Error('ffmpeg not implemented in stub'); },
  async encode() { throw new Error('ffmpeg not implemented in stub'); },
};
```

The Plugin layer (`createBlobCapabilityImpl`) detects `engine.version.includes('stub')` and sets `CapabilityImplementation.status = 'stub'`. `CapabilityRegistry.resolve()` then filters out stub implementations — workflows that reference stub-only capabilities fail with `CAPABILITY_STUB_ONLY` instead of crashing mid-execution.

This pattern lets us declare the **full** capability catalog up front (so the UI, MCP manifest, and docs can list future capabilities) while making the runtime state explicit.

## What the Engine layer explicitly does NOT do

- Know about `Asset` or `AssetId` (only `Blob`)
- Persist anything (the Plugin layer persists outputs via `AssetStore.create`)
- Register capabilities (plugins do that)
- Manage Worker lifecycle (the Runtime's `WorkerHost` does)
- Apply degradation strategies (the Runtime's `pickDegradation` decides; engines just honor `params`)

## Further reading

- [Runtime Layer](./runtime) — what invokes the engine
- [Capability Layer](./capability) — how operations are declared
- [Plugin Layer](./plugin) — how engines are bridged into the Runtime
- [Architecture: Streaming + Memory Defense](../architecture#流式与内存防御w3streaming--memory-defense) — how tiling + MemoryGuard interact
