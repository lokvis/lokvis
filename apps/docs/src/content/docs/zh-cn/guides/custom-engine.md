---
title: 注册自定义图像引擎
description: 实现 ImageEngineAdapter 接口并把它与默认 canvas 引擎一同注册——用于 Squoosh WASM、WebCodecs 或任何自定义图像处理后端。
draft: false
head: []
---

# 注册自定义图像引擎

图像引擎层是可替换的。默认 `canvasEngine` 使用浏览器原生 `createImageBitmap` + `Canvas 2D` + `canvas.toBlob`——零 WASM 依赖、首屏最快、覆盖约 80% 的图像操作。当你需要更好的编码质量（AVIF、高质量 WebP）或非浏览器后端（Node.js + sharp、Squoosh WASM、WebCodecs）时，实现 `ImageEngineAdapter` 接口并注册它。

## 何时写自定义引擎

| 用例 | 默认 `canvasEngine` 够用？ | 需要自定义引擎？ |
|---|---|---|
| Resize / compress / convert PNG/JPEG/WebP | ✅ | — |
| 高质量 AVIF 编码 | ⚠️（浏览器支持参差） | Squoosh WASM |
| 流式 / 分块处理 >500MB 图像 | ❌ | 实现 `StreamingImageEngineAdapter` |
| Node.js CLI / 服务端 | ❌（无 `OffscreenCanvas`） | 基于 sharp 的 adapter |
| 硬件加速的视频帧捕获 | ❌ | WebCodecs adapter |
| 自定义图像滤镜 / 效果 | ✅（通过 `image.filter`） | — |

如果你只是需要一个新**能力**（例如 blur、gamma、AI 抠图），请改写一个 [插件](./write-first-plugin)——你不需要新引擎。

## `ImageEngineAdapter` 接口

定义在 [`packages/engine-image/src/types.ts`](https://github.com/lokvis/lokvis/blob/main/packages/engine-image/src/types.ts)：

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

该接口刻意保持极简：把 Blob **decode** 成 bitmap，把 canvas **encode** 成 Blob。更高层操作（`resize`、`compress`、`convert`、`crop`、`rotate`、`flip`、`watermark`、`background`、`filter`）实现于 `packages/engine-image/src/operations/`，作为调用 `decode` → 操作 → `encode` 的函数。你的自定义引擎只需提供这两个 primitive。

对于流式 / 分块处理（大图），改实现 `StreamingImageEngineAdapter`，它额外添加 `decodeRegion` 与 `mergeChunks` 方法。

## 注册 API

`registerImageEngine` 从 `@lokvis/engine-image` 导出：

```typescript
import { registerImageEngine, getEngine, listEngines, selectBestEngine } from '@lokvis/engine-image';
```

| 函数 | 描述 |
|---|---|
| `registerImageEngine(engine)` | 把一个引擎加入注册表 |
| `getEngine(name?)` | 获取指定引擎（找不到时回退到 `canvasEngine`） |
| `listEngines()` | 列出所有已注册引擎 |
| `selectBestEngine()` | 按注册顺序挑选第一个受支持的引擎 |

注册表初始化时已预注册 `canvasEngine`，并把它同时设为默认与回退。调用 `registerImageEngine(yourEngine)` 会把你的引擎追加到列表——runtime 的 `selectBestEngine()` 会挑第一个 `isSupported()` 返回 `true` 的引擎。

## 最小示例：stub Squoosh 引擎

本示例展示完整结构，无需真正的 WASM 模块。准备好后把 `decode` / `encode` 的函数体替换为真正的 Squoosh 调用即可。

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

## 注册引擎

在应用初始化时调用一次 `registerImageEngine`，**在任何图像操作运行之前**。一个好位置是 `createLokvis()` 之后、挂载组件之前：

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

### 引擎选择顺序

`selectBestEngine()` 按注册顺序遍历引擎，返回第一个 `isSupported()` 解析为 `true` 的：

1. `canvasEngine`（预注册，浏览器中始终受支持）
2. 你之后 `registerImageEngine()` 的任何引擎

要让你的引擎被优先选中，你有两个选项：

**方案 A** —— 在任何操作运行前注册。由于 `canvasEngine` 始终受支持，它总会胜出。要覆盖它，你需要直接操作注册表（目前没有公开 API——见 [§局限](#局限)）。

**方案 B** —— 在你想让自己的引擎胜出的环境中，让你的 `canvasEngine.isSupported()` 返回 `false`。这是一个 workaround；正式的优先级 API 已在计划中。

## Stub 引擎

如果你在开发新引擎但还没实现所有操作，把它标记为 stub：

```typescript
export const myEngine: ImageEngineAdapter = {
  name: 'squoosh',
  version: '0.1.0-stub',  // ← 'stub' suffix triggers stub handling
  supportedCapabilities: ['image.resize'],
  // ...
};
```

按 [`AGENTS.md`](https://github.com/lokvis/lokvis/blob/main/AGENTS.md) 所述，当引擎 adapter 的 version 含 `'stub'` 时：

- 插件层（`buildImageCapabilityImplementations`）把 `CapabilityImplementation.status` 设为 `'stub'`
- `CapabilityRegistry.resolve()` 跳过 stub 实现
- 仅剩 stub 实现时，executor 给出明确错误

这让你可以发布引擎骨架而不破坏 runtime——非 stub 引擎会优先。

## 流式引擎（大图）

对于 >500MB、无法作为单个解码 bitmap 装入内存的图像，实现 `StreamingImageEngineAdapter`：

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

当 `decodeRegion` 可用时，runtime 在分块处理时自动使用它；对非流式引擎回退到全图 `decode`。

## Node.js 引擎（服务端）

对于服务端处理（CLI、MCP server、CI 脚本），同一个 `ImageEngineAdapter` 接口可用——但你需要一个 Node 兼容的 decode / encode 实现。`@lokvis/engine-image/node` 子路径提供一个基于 `sharp` 的 adapter，把 `createImageBitmap` 换成 sharp 的 buffer API。

```typescript
// In a Node.js context (CLI / MCP server)
import { registerImageEngine } from '@lokvis/engine-image/node';
import { sharpEngine } from '@lokvis/engine-image/node';
// (sharpEngine is hypothetical — not yet implemented as of Alpha)

registerImageEngine(sharpEngine);
```

> **注意：**Node.js sharp 引擎尚未实现。今天 CLI 在 Node.js Worker 中用带 `OffscreenCanvas` polyfill 的同一 canvas 引擎。当前用法参见 [CLI 自动化指南](./cli-automation)。

## 测试你的引擎

参考现有的引擎测试模式（`packages/engine-image/src/__tests__/canvas-engine.test.ts`）：

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

## 局限

- **没有优先级字段**：注册表按注册顺序选第一个受支持的引擎。`canvasEngine` 总是预注册，所以它总赢。要覆盖它，当前需要操作注册表内部（无公开 API）。计划添加 `priority` 字段或 `setPreferredEngine(name)`。
- **不支持运行时切换**：一旦引擎被选中，切换到另一个引擎需要重新初始化 runtime。不支持热切换。
- **canvasEngine 不支持流式**：默认 canvas 引擎实现了 `ImageEngineAdapter` 但没实现 `StreamingImageEngineAdapter`。分块处理通过 `createImageBitmap` 的 resize 选项近似，但不是真正的流式。
- **Stub-only 回退**：如果某个能力只注册了 stub 引擎，runtime 会抛 `CapabilityStubOnlyError`。请确保你想用的每个能力至少有一个非 stub 引擎支持。

## 参考

- [`packages/engine-image/src/types.ts`](https://github.com/lokvis/lokvis/blob/main/packages/engine-image/src/types.ts) —— `ImageEngineAdapter` 接口、params 类型
- [`packages/engine-image/src/adapter.ts`](https://github.com/lokvis/lokvis/blob/main/packages/engine-image/src/adapter.ts) —— 注册表 + `registerImageEngine`
- [`packages/engine-image/src/canvas-engine.ts`](https://github.com/lokvis/lokvis/blob/main/packages/engine-image/src/canvas-engine.ts) —— 参考实现
- [架构：Engine](../architecture/engine) —— 引擎层概览
- [API 参考：engine-image](../../api/engine-image) —— 完整 TypeDoc
