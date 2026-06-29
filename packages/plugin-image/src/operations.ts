/**
 * Image Capability 实现
 *
 * 把 engine-image 的 Blob ↔ Blob 操作包装为 CapabilityImplementation：
 *   Asset[] + params → Asset[]
 *
 * 关键流程：
 *   1. 通过 ctx.runtime.getAssetBlob 读取输入 Asset 的 Blob
 *   2. 调用 engine-image 对应操作（resize / compress / ...）
 *   3. 通过 ctx.runtime.createAsset 把输出 Blob 注册为新 Asset
 */

import type {
  Asset,
  CapabilityImplementation,
  ExecutionContext,
} from '@lokvis/schema';
import type { PluginContext } from '@lokvis/schema';
import {
  resize as opResize,
  compress as opCompress,
  convert as opConvert,
  crop as opCrop,
  rotate as opRotate,
  flip as opFlip,
  watermark as opWatermark,
  setBackground as opSetBackground,
} from '@lokvis/engine-image';
import type {
  BackgroundParams,
  CompressParams,
  ConvertParams,
  CropParams,
  FlipParams,
  ResizeParams,
  RotateParams,
  WatermarkParams,
} from '@lokvis/engine-image';

/** Capability 名 → 操作函数的映射类型 */
export type ImageOperation = (
  blob: Blob,
  params: Record<string, unknown>
) => Promise<Blob>;

/** 图像能力实现项 */
export interface ImageCapabilityEntry {
  /** 对应 Capability 名 */
  capability: string;
  /** 引擎名 */
  engine: string;
  /** 实际执行函数（Blob → Blob） */
  operation: ImageOperation;
}

/** 将 Blob 操作包装为标准 CapabilityImplementation */
function wrapAsImplementation(
  entry: ImageCapabilityEntry,
  ctx: PluginContext
): CapabilityImplementation {
  return {
    capability: entry.capability,
    engine: entry.engine,
    async execute(inputs: Asset[], params: Record<string, unknown>, execCtx: ExecutionContext): Promise<Asset[]> {
      if (inputs.length === 0) {
        throw new Error(`Capability "${entry.capability}" requires at least one input asset`);
      }
      const outputs: Asset[] = [];
      for (let i = 0; i < inputs.length; i++) {
        if (execCtx.signal.aborted) {
          throw new DOMException('Aborted', 'AbortError');
        }
        const asset = inputs[i]!;
        execCtx.onProgress?.(i / inputs.length, `Processing ${i + 1}/${inputs.length}`);
        const blob = await ctx.runtime.getAssetBlob(asset);
        const outBlob = await entry.operation(blob, params);
        const metadata = deriveOutputMetadata(asset, outBlob);
        const outAsset = await ctx.runtime.createAsset(outBlob, metadata, 'image');
        outputs.push(outAsset);
      }
      execCtx.onProgress?.(1, 'Done');
      return outputs;
    },
  };
}

/** 从原 Asset 与输出 Blob 派生新 Asset 的元数据 */
function deriveOutputMetadata(
  source: Asset,
  outBlob: Blob
): import('@lokvis/schema').AssetMetadata {
  const mimeType = outBlob.type || source.metadata.mimeType;
  const format = mimeType.split('/')[1] ?? source.metadata.format;
  return {
    mimeType,
    size: outBlob.size,
    format,
    dimensions: source.metadata.dimensions,
  };
}

// ─── 各操作的参数转换 + 调用 ───────────────────────────────

const resizeOp: ImageOperation = (blob, params) =>
  opResize(blob, params as unknown as ResizeParams);

const compressOp: ImageOperation = (blob, params) =>
  opCompress(blob, params as unknown as CompressParams);

const convertOp: ImageOperation = (blob, params) =>
  opConvert(blob, params as unknown as ConvertParams);

const cropOp: ImageOperation = (blob, params) =>
  opCrop(blob, params as unknown as CropParams);

const rotateOp: ImageOperation = (blob, params) =>
  opRotate(blob, params as unknown as RotateParams);

const flipOp: ImageOperation = (blob, params) =>
  opFlip(blob, params as unknown as FlipParams);

const watermarkOp: ImageOperation = (blob, params) =>
  opWatermark(blob, params as unknown as WatermarkParams);

const backgroundOp: ImageOperation = (blob, params) =>
  opSetBackground(blob, params as unknown as BackgroundParams);

/** 全部图像能力实现项 */
export const IMAGE_CAPABILITY_ENTRIES: ImageCapabilityEntry[] = [
  { capability: 'image.resize',      engine: 'canvas', operation: resizeOp },
  { capability: 'image.compress',    engine: 'canvas', operation: compressOp },
  { capability: 'image.convert',     engine: 'canvas', operation: convertOp },
  { capability: 'image.crop',        engine: 'canvas', operation: cropOp },
  { capability: 'image.rotate',      engine: 'canvas', operation: rotateOp },
  { capability: 'image.flip',        engine: 'canvas', operation: flipOp },
  { capability: 'image.watermark',   engine: 'canvas', operation: watermarkOp },
  { capability: 'image.background',  engine: 'canvas', operation: backgroundOp },
];

/**
 * 构造所有图像能力的 CapabilityImplementation
 * （由 plugin.ts 在 installer 中调用）
 */
export function buildImageCapabilityImplementations(
  ctx: PluginContext
): CapabilityImplementation[] {
  return IMAGE_CAPABILITY_ENTRIES.map((entry) => wrapAsImplementation(entry, ctx));
}
