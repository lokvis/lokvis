/**
 * 图像操作聚合入口(Node 引擎)
 *
 * 与浏览器版 operations/index.ts 对齐,导出 5 个核心操作 + 元数据读取:
 * - transform.ts: resize / crop
 * - encode.ts:    compress / convert
 * - watermark.ts: watermark
 * - metadata.ts:  getMetadata(width/height/format,不返回位图)
 *
 * rotate / flip / background / filter 暂未在 Node 引擎实现,
 * plugin-image 会回退到 stub 实现并给出明确错误提示。
 */
export * from './utils.js';
export * from './transform.js';
export * from './encode.js';
export * from './watermark.js';
export * from './metadata.js';
