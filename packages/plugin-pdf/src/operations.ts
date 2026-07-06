/**
 * PDF Capability 实现
 *
 * 把 engine-pdf 的 Blob ↔ Blob 操作包装为 CapabilityImplementation:
 *   Asset[] + params → Asset[]
 *
 * 三种形态全部走 plugin-sdk 工厂,与 plugin-image / plugin-video 共享
 * "取 blob → 调 operation → 派生 metadata → createAsset → 进度/取消"五步样板:
 * - single(1→1):createBlobCapabilityImpl
 * - merge(N→1):createMergeCapabilityImpl
 * - split(1→N):createSplitCapabilityImpl
 *
 * 注意:当前 engine-pdf 为占位实现,所有方法都会抛出异常,
 * 因此 plugin-pdf 的各操作在运行时也会抛出 —— 这是有意为之的 stub 行为。
 */

import { getPdfEngine } from '@lokvis/engine-pdf';
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

/** PDF 能力实现项 */
export interface PdfCapabilityEntry {
  /** 对应 Capability 名 */
  capability: string;
  /** 引擎名 */
  engine: string;
  /** 操作形态:single(1→1) / merge(N→1) / split(1→N) */
  kind: PdfOperationKind;
  /** 输出 Asset 类型 */
  outputType: AssetType;
  /** 实际执行函数 */
  operation: SinglePdfOperation | MergePdfOperation | SplitPdfOperation;
}

/** 获取 pdf-lib 引擎适配器 */
const engine = () => getPdfEngine('pdf-lib');

// ─── 各操作的参数转换 + 调用 ───────────────────────────────

const mergeOp: MergePdfOperation = (blobs, params) =>
  engine().merge(blobs, params);

const splitOp: SplitPdfOperation = (blob, params) =>
  engine().split(blob, params);

const compressOp: SinglePdfOperation = (blob, params) =>
  engine().compress(blob, params);

const rotateOp: SinglePdfOperation = (blob, params) =>
  engine().rotate(blob, params);

const watermarkOp: SinglePdfOperation = (blob, params) =>
  engine().watermark(blob, params);

// OCR / SIGN:engine-pdf 暂未提供对应方法,运行时直接抛出
const ocrOp: SinglePdfOperation = async () => {
  throw new Error('pdf.ocr 暂未实现:engine-pdf 未提供 ocr() 方法');
};

const signOp: SinglePdfOperation = async () => {
  throw new Error('pdf.sign 暂未实现:engine-pdf 未提供 sign() 方法');
};

/** 全部 PDF 能力实现项 */
export const PDF_CAPABILITY_ENTRIES: PdfCapabilityEntry[] = [
  { capability: 'pdf.merge',     engine: 'pdf-lib', kind: 'merge',  outputType: 'pdf',  operation: mergeOp },
  { capability: 'pdf.split',     engine: 'pdf-lib', kind: 'split',  outputType: 'data', operation: splitOp },
  { capability: 'pdf.compress',  engine: 'pdf-lib', kind: 'single', outputType: 'pdf',  operation: compressOp },
  { capability: 'pdf.rotate',    engine: 'pdf-lib', kind: 'single', outputType: 'pdf',  operation: rotateOp },
  { capability: 'pdf.watermark', engine: 'pdf-lib', kind: 'single', outputType: 'pdf',  operation: watermarkOp },
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
 * 构造所有 PDF 能力的 CapabilityImplementation
 * (由 plugin.ts 在 installer 中调用)
 *
 * stub 检测在此一次性完成(AGENTS.md 约定:version.includes('stub')),
 * 不再在 merge/split 包装函数中重复检测。
 */
export function buildPdfCapabilityImplementations(
  ctx: PluginContext
): CapabilityImplementation[] {
  // 引擎 stub 标识只检测一次,避免在多处重复读取 engine.version
  const isStub = engine().version.includes('stub');

  return PDF_CAPABILITY_ENTRIES.map((entry) => {
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
