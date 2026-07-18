/**
 * @lokvis/engine-pdf
 *
 * PDF Engine 层 — 基于 pdf-lib 的 Blob↔Blob 纯函数操作。
 *
 * 设计说明:
 * - 本包只暴露独立操作(mergePdfs / compressPdf / getPdfInfo),供消费方
 *   (plugin-pdf/node、mcp-server tool handler)直接调用
 * - 不再提供 PdfEngineAdapter 接口与 pdfLibEngine / pdfjsEngine stub 占位
 *   (浏览器端 plugin-pdf 改为全 stub,见 packages/plugin-pdf/src/operations.ts)
 * - AGENTS.md:Engine 层只暴露 Blob↔Blob 纯函数,不感知 Asset/Workflow
 * - 仅用标准 Blob/ArrayBuffer/Uint8Array,在浏览器与 Node 均可类型检查
 *
 * 参考 docs/whitepaper/04-技术架构设计.md 第六节「Engine Layer」。
 */

export {
  mergePdfs,
  compressPdf,
  getPdfInfo,
  type PdfMergeParams,
  type PdfCompressParams,
  type PdfInfo,
} from './operations.js';
