/**
 * 图像操作聚合入口(Node 引擎)
 *
 * 与浏览器版 operations/index.ts 对齐,导出全部 10 个操作 + 元数据读取:
 * - transform.ts: resize / crop
 * - encode.ts:    compress / convert
 * - watermark.ts: watermark
 * - geometry.ts:  rotate / flip
 * - effects.ts:   background / filter
 * - favicon.ts:   encodeIco
 * - metadata.ts:  getMetadata(width/height/format,不返回位图)
 */
export * from './utils.js';
export * from './transform.js';
export * from './encode.js';
export * from './watermark.js';
export * from './geometry.js';
export * from './effects.js';
export * from './favicon.js';
export * from './metadata.js';
