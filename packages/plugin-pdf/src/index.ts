/**
 * @lokvis/plugin-pdf
 *
 * 官方 PDF 处理插件。通过 engine-pdf 实现 7 个核心 PDF 能力：
 * merge / split / compress / rotate / watermark / ocr / sign
 *
 * 设计原则：
 * - Plugin 只看到 PluginContext（Runtime 受限 API）与 engine-pdf
 * - 不直接依赖 React / Redux / Cloud
 *
 * 参考 docs/whitepaper/04-技术架构设计.md 第七节「Plugin Layer」。
 */

export { pdfToolsPlugin as default, pdfToolsPlugin } from './plugin.js';
export {
  buildPdfCapabilityImplementations,
  type PdfCapabilityEntry,
} from './operations.js';
