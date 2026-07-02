/**
 * PDF Capability 实现
 *
 * 把 engine-pdf 的 Blob ↔ Blob 操作包装为 CapabilityImplementation：
 *   Asset[] + params → Asset[]
 *
 * 关键流程：
 *   1. 通过 ctx.runtime.getAssetBlob 读取输入 Asset 的 Blob
 *   2. 调用 engine-pdf 对应操作（merge / split / rotate / ...）
 *   3. 通过 ctx.runtime.createAsset 把输出 Blob 注册为新 Asset
 *
 * 注意：当前 engine-pdf 为占位实现，所有方法都会抛出异常，
 * 因此 plugin-pdf 的各操作在运行时也会抛出 —— 这是有意为之的 stub 行为。
 */

import { getPdfEngine } from '@lokvis/engine-pdf';
import type {
  Asset,
  AssetMetadata,
  AssetType,
  CapabilityImplementation,
  ExecutionContext,
  PluginContext,
} from '@lokvis/schema';

/** PDF 操作形态：single(1→1) / merge(N→1) / split(1→N) */
export type PdfOperationKind = 'single' | 'merge' | 'split';

/** 单输入 → 单输出操作（compress / rotate / watermark / ocr / sign） */
export type SinglePdfOperation = (
  blob: Blob,
  params: Record<string, unknown>
) => Promise<Blob>;

/** 多输入 → 单输出操作（merge） */
export type MergePdfOperation = (
  blobs: Blob[],
  params: Record<string, unknown>
) => Promise<Blob>;

/** 单输入 → 多输出操作（split） */
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
  /** 操作形态：single(1→1) / merge(N→1) / split(1→N) */
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

// OCR / SIGN：engine-pdf 暂未提供对应方法，运行时直接抛出
const ocrOp: SinglePdfOperation = async () => {
  throw new Error('pdf.ocr 暂未实现：engine-pdf 未提供 ocr() 方法');
};

const signOp: SinglePdfOperation = async () => {
  throw new Error('pdf.sign 暂未实现：engine-pdf 未提供 sign() 方法');
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

/** 将 PDF 操作包装为标准 CapabilityImplementation */
function wrapAsImplementation(
  entry: PdfCapabilityEntry,
  ctx: PluginContext
): CapabilityImplementation {
  const engineAdapter = getPdfEngine(entry.engine as 'pdf-lib');
  const isStub = engineAdapter.version.includes('stub');
  return {
    capability: entry.capability,
    engine: entry.engine,
    status: isStub ? 'stub' : 'stable',
    async execute(
      inputs: Asset[],
      params: Record<string, unknown>,
      execCtx: ExecutionContext
    ): Promise<Asset[]> {
      if (inputs.length === 0) {
        throw new Error(`Capability "${entry.capability}" requires at least one input asset`);
      }

      // merge：多输入 → 单输出
      if (entry.kind === 'merge') {
        const blobs: Blob[] = [];
        for (let i = 0; i < inputs.length; i++) {
          if (execCtx.signal.aborted) {
            throw new DOMException('Aborted', 'AbortError');
          }
          const asset = inputs[i]!;
          execCtx.onProgress?.(i / inputs.length, `Reading ${i + 1}/${inputs.length}`);
          blobs.push(await ctx.runtime.getAssetBlob(asset));
        }
        execCtx.onProgress?.(0.9, 'Merging');
        const outBlob = await (entry.operation as MergePdfOperation)(blobs, params);
        const outAsset = await ctx.runtime.createAsset(
          outBlob,
          deriveOutputMetadata(outBlob, entry.outputType),
          entry.outputType
        );
        execCtx.onProgress?.(1, 'Done');
        return [outAsset];
      }

      // split / single：单输入 → 多输出 或 单输出，逐个输入处理
      const outputs: Asset[] = [];
      for (let i = 0; i < inputs.length; i++) {
        if (execCtx.signal.aborted) {
          throw new DOMException('Aborted', 'AbortError');
        }
        const asset = inputs[i]!;
        execCtx.onProgress?.(i / inputs.length, `Processing ${i + 1}/${inputs.length}`);
        const blob = await ctx.runtime.getAssetBlob(asset);

        if (entry.kind === 'split') {
          const outBlobs = await (entry.operation as SplitPdfOperation)(blob, params);
          for (const outBlob of outBlobs) {
            outputs.push(
              await ctx.runtime.createAsset(
                outBlob,
                deriveOutputMetadata(outBlob, entry.outputType),
                entry.outputType
              )
            );
          }
        } else {
          const outBlob = await (entry.operation as SinglePdfOperation)(blob, params);
          outputs.push(
            await ctx.runtime.createAsset(
              outBlob,
              deriveOutputMetadata(outBlob, entry.outputType),
              entry.outputType
            )
          );
        }
      }
      execCtx.onProgress?.(1, 'Done');
      return outputs;
    },
  };
}

/** 从输出 Blob 派生新 Asset 的元数据 */
function deriveOutputMetadata(
  outBlob: Blob,
  outputType: AssetType
): AssetMetadata {
  const fallback = defaultMimeTypeAndFormat(outputType);
  const mimeType = outBlob.type || fallback.mimeType;
  const format = mimeType.split('/')[1] ?? fallback.format;
  return {
    mimeType,
    size: outBlob.size,
    format,
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
 * （由 plugin.ts 在 installer 中调用）
 */
export function buildPdfCapabilityImplementations(
  ctx: PluginContext
): CapabilityImplementation[] {
  return PDF_CAPABILITY_ENTRIES.map((entry) => wrapAsImplementation(entry, ctx));
}
