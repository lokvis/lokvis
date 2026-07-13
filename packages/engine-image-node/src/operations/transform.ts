/**
 * 几何变换操作:resize / crop
 *
 * 基于 sharp 的 resize / extract API 实现,
 * 与 engine-image operations/transform.ts 同名操作对齐。
 */
import type { CropParams } from '../types.js';
import {
  computeTargetSize,
  inferFormat,
  throwIfAborted,
  toSharpFormat,
} from './utils.js';

/** 从 Blob 读取 Buffer,供 sharp 处理 */
async function blobToBuffer(blob: Blob): Promise<Buffer> {
  const arrayBuffer = await blob.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/** 从 sharp pipeline 输出 Blob */
async function sharpToBlob(
  pipeline: import('sharp').Sharp,
  format: string,
  quality: number
): Promise<Blob> {
  const buffer = await pipeline
    .toFormat(format as any, { quality })
    .toBuffer();
  return new Blob([buffer], {
    type: `image/${format === 'jpeg' ? 'jpeg' : format}`,
  });
}

/**
 * Resize:调整尺寸。
 *
 * 与 engine-image resize 对齐:
 * - 支持 width / height / fit / maintainAspectRatio
 * - inferFormat 推断输出格式(默认 png)
 * - 不嵌入 PNG DPI(Node 引擎暂不支持,留待后续)
 */
export async function resize(
  blob: Blob,
  params: Record<string, any>,
  signal?: AbortSignal
): Promise<Blob> {
  const sharp = (await import('sharp')).default;
  throwIfAborted(signal);

  // 先 metadata 拿到源尺寸,与 engine-image 一致(computeTargetSize 需要源尺寸)
  const srcBuffer = await blobToBuffer(blob);
  throwIfAborted(signal);
  const meta = await sharp(srcBuffer).metadata();
  const srcW = meta.width ?? 0;
  const srcH = meta.height ?? 0;
  if (srcW === 0 || srcH === 0) {
    throw new Error('resize: invalid image dimensions');
  }

  const target = computeTargetSize(srcW, srcH, params);
  throwIfAborted(signal);

  // engine-image 的 computeTargetSize 已按 fit 策略计算最终尺寸(不裁剪),
  // sharp resize 用 fit='fill' 强制到 target 尺寸,避免 sharp 再次"智能"调整
  // (sharp fit='cover' 会裁剪以填满,与 engine-image drawImage 不裁剪行为不一致)
  const pipeline = sharp(srcBuffer).resize({
    width: target.width,
    height: target.height,
    fit: 'fill',
    withoutEnlargement: false,
  });

  throwIfAborted(signal);
  const format = inferFormat(blob, 'png');
  return sharpToBlob(pipeline, toSharpFormat(format), 95);
}

/**
 * Crop:裁剪(从源图提取矩形区域)。
 *
 * 与 engine-image crop 对齐:
 * - 接受 { x, y, width, height }(左上角 + 区域大小)
 * - sharp 用 extract({ left, top, width, height })实现
 */
export async function crop(
  blob: Blob,
  params: Record<string, any>,
  signal?: AbortSignal
): Promise<Blob> {
  const sharp = (await import('sharp')).default;
  throwIfAborted(signal);

  const { x, y, width, height } = params as CropParams;
  if (
    typeof x !== 'number' ||
    typeof y !== 'number' ||
    typeof width !== 'number' ||
    typeof height !== 'number'
  ) {
    throw new Error(
      'crop requires { x, y, width, height } all as numbers'
    );
  }
  if (width <= 0 || height <= 0) {
    throw new Error('crop width and height must be positive');
  }

  const srcBuffer = await blobToBuffer(blob);
  throwIfAborted(signal);

  const pipeline = sharp(srcBuffer).extract({
    left: Math.max(0, Math.round(x)),
    top: Math.max(0, Math.round(y)),
    width: Math.round(width),
    height: Math.round(height),
  });

  throwIfAborted(signal);
  const format = inferFormat(blob, 'png');
  return sharpToBlob(pipeline, toSharpFormat(format), 95);
}
