/**
 * @lokvis/engine-pdf
 *
 * PDF Engine 层 — 基于 pdf-lib 的 Blob↔Blob 纯函数操作。
 *
 * 设计说明:
 * - 本包暴露 PDF 操作:merge / split / compress / rotate / addWatermark /
 *   addPageNumbers / ocrPdf(stub) + 1 个元数据查询 getPdfInfo,供消费方
 *   (plugin-pdf/node、mcp-server tool handler)直接调用
 * - 不再提供 PdfEngineAdapter 接口与 pdfLibEngine / pdfjsEngine stub 占位
 *   (浏览器端 plugin-pdf 改为全 stub,见 packages/plugin-pdf/src/operations.ts)
 * - AGENTS.md:Engine 层只暴露 Blob↔Blob 纯函数,不感知 Asset/Workflow
 * - 仅用标准 Blob/ArrayBuffer/Uint8Array,在浏览器与 Node 均可类型检查
 *
 * O-17 边界张力说明:getPdfInfo(blob): Promise<PdfInfo> 是 Blob→结构化
 * 元数据(页数),非 Blob↔Blob。接受为合理边界张力,理由:
 * 1. 元数据读取是 Engine 层的合理职责(需解析 PDF 二进制才能获取页数)
 * 2. 与 engine-ai/structured 的 ocr/caption 同属「Blob→信息提取」形态
 * 3. 消费方(plugin-pdf/node 的 MetadataReader、mcp-server 的 readAssetPdfInfo)
 *    需要此操作读取页数,拆子路径会增加无谓复杂度
 * 4. engine-image 也有类似的 dimensions 读取(经 MetadataReader 注入,非主入口)
 *    engine-pdf 的 getPdfInfo 对齐此模式,保留在主入口并明确标注边界张力
 *
 * 参考 docs/whitepaper/04-技术架构设计.md 第六节「Engine Layer」。
 */

export {
  mergePdfs,
  splitPdf,
  compressPdf,
  rotatePdf,
  addWatermark,
  addPageNumbers,
  ocrPdf,
  getPdfInfo,
  type PdfMergeParams,
  type PdfSplitParams,
  type PdfCompressParams,
  type PdfRotateParams,
  type PdfWatermarkParams,
  type PdfAddPageNumbersParams,
  type PdfPageNumberPosition,
  type PdfOcrParams,
  type PdfInfo,
} from './operations.js';
