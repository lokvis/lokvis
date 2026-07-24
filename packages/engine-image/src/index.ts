/**
 * @lokvis/engine-image
 *
 * 图像引擎适配层（Engine Adapter）。
 *
 * 设计原则：
 * - Runtime 永远不知道 FFmpeg / Squoosh，只知道 Capability
 * - 引擎可替换：浏览器原生 Canvas / Squoosh WASM / WebCodecs
 *
 * MVP 策略：使用浏览器原生 Canvas + createImageBitmap 实现，
 * 零 WASM 依赖、首屏最快、覆盖 80% 图像处理需求。
 * 后续可通过同一适配层接入 Squoosh WASM 获得更优编码质量（AVIF/高质量 WebP）。
 *
 * 参考 docs/whitepaper/04-技术架构设计.md 第六节「Engine Layer」。
 */

export * from './types.js';
export * from './canvas-engine.js';
export * from './operations/index.js';
export * from './adapter.js';
export * from './worker-adapter.js';

// ─── 懒加载接口（W15.2）──────────────────────────────────────────
// 用户触发工具时才 dynamic import 对应 operation（减少首屏 JS 体积），
// prefetchOnHover 在 hover 工具按钮时预加载。同一接口未来承载 WASM 引擎。
export {
  lazyLoadOperation,
  prefetchOperation,
  preloadTop5Operations,
  clearOperationCache,
  isOperationLoaded,
  TOP_5_OPERATIONS,
} from './lazy.js';
export type { BlobOperation } from './lazy.js';

// ─── WASM 编码器配置（AVIF 兜底，设计文档 20260724-engine-wasm-avif-encoder.md）──
// native-first / wasm-fallback：canvas 原生编码器缺失时自动加载 WASM AVIF 编码器。
// 消费方可 configureWasmEncoders({ avifUrl }) 自托管 wasm 二进制，或 enabled: false 关闭。
export {
  configureWasmEncoders,
  resolveAvifWasmUrl,
  wasmEncodersEnabled,
  resetWasmEncoderConfig,
} from './wasm-config.js';
export type { WasmEncoderConfig } from './wasm-config.js';
