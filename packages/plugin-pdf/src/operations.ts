/**
 * PDF Capability 实现(浏览器版,全 stub)
 *
 * 浏览器端不加载 pdf-lib(体积大,且 Node 端 API 与浏览器略有差异),
 * 所有 PDF capability 标记为 stub,CapabilityRegistry.resolve() 自动跳过,
 * executor 在 stub-only 时给出明确错误提示。
 *
 * 真实 PDF 操作(merge/compress)由 Node 端 plugin-pdf/node 提供,经子路径
 * `@lokvis/plugin-pdf/node` 导出,供 mcp-server 等消费方使用。
 *
 * 三种形态全部走 plugin-sdk 工厂,与 plugin-image / plugin-video 共享
 * "取 blob → 调 operation → 派生 metadata → createAsset → 进度/取消"五步样板:
 * - single(1→1):createBlobCapabilityImpl
 * - merge(N→1):createMergeCapabilityImpl
 * - split(1→N):createSplitCapabilityImpl
 *
 * 能力声明(PDF_CAPABILITIES)由 codegen 从 manifests/pdf.manifest.json 生成,
 * 见 packages/capability/src/presets/pdf.generated.ts。本文件只负责 impl 绑定
 * (capability name → engine + kind + outputType + operation)。
 *
 * AGENTS.md Stub Engine 约定:
 * - 所有 operation 方法抛出 `new Error('xxx not implemented in stub')`
 * - isStub=true 让 CapabilityRegistry.resolve() 自动跳过
 */

import {
  createBlobCapabilityImpl,
  createMergeCapabilityImpl,
  createSplitCapabilityImpl,
} from '@lokvis/plugin-sdk';
import type {
  AssetMetadata,
  AssetType,
  CapabilityImplementation,
  PluginContext,
} from '@lokvis/schema';

/** PDF 操作形态:single(1→1) / merge(N→1) / split(1→N) */
export type PdfOperationKind = 'single' | 'merge' | 'split';

/** 单输入 → 单输出操作(compress / rotate / watermark / ocr / sign) */
export type SinglePdfOperation = (
  blob: Blob,
  params: Record<string, unknown>
) => Promise<Blob>;

/** 多输入 → 单输出操作(merge) */
export type MergePdfOperation = (
  blobs: Blob[],
  params: Record<string, unknown>
) => Promise<Blob>;

/** 单输入 → 多输出操作(split) */
export type SplitPdfOperation = (
  blob: Blob,
  params: Record<string, unknown>
) => Promise<Blob[]>;

/** PDF 能力实现绑定项 */
export interface PdfOperationEntry {
  /** 对应 Capability 名(与 generated 声明的 name 字段关联) */
  capability: string;
  /** 引擎名 */
  engine: string;
  /** 操作形态:single(1→1) / merge(N→1) / split(1→N) */
  kind: PdfOperationKind;
  /** 输出 Asset 类型 */
  outputType: AssetType;
  /** 实际执行函数(浏览器版永远抛 stub 错误) */
  operation: SinglePdfOperation | MergePdfOperation | SplitPdfOperation;
}

// ─── stub 操作(浏览器版不加载 pdf-lib,所有操作抛错) ───────────

/** 统一 stub 错误消息 */
function stubMessage(capability: string): string {
  return `${capability} not implemented in stub (browser plugin-pdf). Use @lokvis/plugin-pdf/node for real operations.`;
}

const mergeOp: MergePdfOperation = async (_blobs, _params) => {
  throw new Error(stubMessage('pdf.merge'));
};

const splitOp: SplitPdfOperation = async (_blob, _params) => {
  throw new Error(stubMessage('pdf.split'));
};

const compressOp: SinglePdfOperation = async (_blob, _params) => {
  throw new Error(stubMessage('pdf.compress'));
};

const rotateOp: SinglePdfOperation = async (_blob, _params) => {
  throw new Error(stubMessage('pdf.rotate'));
};

const watermarkOp: SinglePdfOperation = async (_blob, _params) => {
  throw new Error(stubMessage('pdf.watermark'));
};

const addPageNumbersOp: SinglePdfOperation = async (_blob, _params) => {
  throw new Error(stubMessage('pdf.add-page-numbers'));
};

const ocrOp: SinglePdfOperation = async (_blob, _params) => {
  throw new Error(stubMessage('pdf.ocr'));
};

const signOp: SinglePdfOperation = async (_blob, _params) => {
  throw new Error(stubMessage('pdf.sign'));
};

/** 全部 PDF 能力实现绑定(operation → engine + kind + outputType 映射,能力声明由 generated 提供) */
export const PDF_OPERATION_ENTRIES: PdfOperationEntry[] = [
  { capability: 'pdf.merge',     engine: 'pdf-lib', kind: 'merge',  outputType: 'pdf',  operation: mergeOp },
  { capability: 'pdf.split',     engine: 'pdf-lib', kind: 'split',  outputType: 'data', operation: splitOp },
  { capability: 'pdf.compress',  engine: 'pdf-lib', kind: 'single', outputType: 'pdf',  operation: compressOp },
  { capability: 'pdf.rotate',    engine: 'pdf-lib', kind: 'single', outputType: 'pdf',  operation: rotateOp },
  { capability: 'pdf.watermark', engine: 'pdf-lib', kind: 'single', outputType: 'pdf',  operation: watermarkOp },
  { capability: 'pdf.add-page-numbers', engine: 'pdf-lib', kind: 'single', outputType: 'pdf', operation: addPageNumbersOp },
  { capability: 'pdf.ocr',       engine: 'pdf-lib', kind: 'single', outputType: 'text', operation: ocrOp },
  { capability: 'pdf.sign',      engine: 'pdf-lib', kind: 'single', outputType: 'pdf',  operation: signOp },
];

/** 从输出 Blob 派生新 Asset 的元数据(不读 source,PDF 变换不传播 dimensions) */
function derivePdfMetadata(outputType: AssetType): (outBlob: Blob) => AssetMetadata {
  const fallback = defaultMimeTypeAndFormat(outputType);
  return (outBlob: Blob) => {
    const mimeType = outBlob.type || fallback.mimeType;
    const format = mimeType.split('/')[1] ?? fallback.format;
    return { mimeType, size: outBlob.size, format };
  };
}

/** 各输出类型的默认 MIME / format */
function defaultMimeTypeAndFormat(
  type: AssetType
): { mimeType: string; format: string } {
  switch (type) {
    case 'pdf':
      return { mimeType: 'application/pdf', format: 'pdf' };
    case 'text':
      return { mimeType: 'text/plain', format: 'txt' };
    case 'data':
      return { mimeType: 'application/octet-stream', format: 'bin' };
    default:
      return { mimeType: 'application/octet-stream', format: 'bin' };
  }
}

/**
 * 构造所有 PDF 能力的 CapabilityImplementation(浏览器版,全 stub)
 *
 * 由 plugin.ts 在 installer 中调用。AGENTS.md Stub Engine 约定:
 * isStub=true 让 CapabilityRegistry.resolve() 自动跳过本实现,
 * executor 在 stub-only 时给出明确错误提示。
 */
export function buildPdfCapabilityImplementations(
  ctx: PluginContext
): CapabilityImplementation[] {
  // 浏览器版无真实操作,所有 capability 标记为 stub
  const isStub = true;

  return PDF_OPERATION_ENTRIES.map((entry) => {
    const derive = derivePdfMetadata(entry.outputType);

    switch (entry.kind) {
      case 'merge':
        return createMergeCapabilityImpl(
          {
            capability: entry.capability,
            engine: entry.engine,
            outputType: entry.outputType,
            operation: entry.operation as MergePdfOperation,
            isStub,
            deriveMetadata: derive,
          },
          ctx
        );
      case 'split':
        return createSplitCapabilityImpl(
          {
            capability: entry.capability,
            engine: entry.engine,
            outputType: entry.outputType,
            operation: entry.operation as SplitPdfOperation,
            isStub,
            deriveMetadata: derive,
          },
          ctx
        );
      case 'single':
        return createBlobCapabilityImpl(
          {
            capability: entry.capability,
            engine: entry.engine,
            outputType: entry.outputType,
            operation: entry.operation as SinglePdfOperation,
            isStub,
            // 工厂签名是 (source, outBlob) => AssetMetadata,但 PDF 不读 source,
            // 用包装层丢弃 source 只传 outBlob,语义更清晰
            deriveMetadata: (_source, outBlob) => derive(outBlob),
          },
          ctx
        );
    }
  });
}
