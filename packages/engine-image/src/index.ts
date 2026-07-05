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
export * from './lazy.js';
