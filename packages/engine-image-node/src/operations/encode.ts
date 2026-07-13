/**
 * 编码与格式操作:compress / convert
 *
 * 基于 sharp 的 toFormat + quality 实现,
 * 与 engine-image operations/encode.ts 同名操作对齐。
 *
 * 注意:
 * - targetSize(目标体积压缩)由上层二分查找实现,本引擎不内置
 *   (engine-image 用 compressToTargetSize 实现,Node 引擎留待后续)
 * - convert 时若输出为 jpeg,sharp 自动用白底填充透明区域
 *   (与 engine-image convert 一致)
 */
import type { CompressParams, ConvertParams, ImageOutputFormat } from '../types.js';
import {
  normalizeQuality,
  throwIfAborted,
  toSharpFormat,
} from './utils.js';

async function blobToBuffer(blob: Blob): Promise<Buffer> {
  const arrayBuffer = await blob.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

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
 * Compress:压缩(可同时改变格式)。
 *
 * 与 engine-image compress 对齐:
 * - 默认输出 webp(quality 85),与浏览器版一致
 * - targetSize 当前不实现(抛错提示),后续可补 compressToTargetSize 等价实现
 */
export async function compress(
  blob: Blob,
  params: Record<string, any>,
  signal?: AbortSignal
): Promise<Blob> {
  const sharp = (await import('sharp')).default;
  throwIfAborted(signal);

  const { format: rawFormat, quality, targetSize } = params as CompressParams;
  if (targetSize) {
    // Node 引擎暂不内置二分查找,留待后续与 engine-image compressToTargetSize 对齐
    throw new Error(
      'compress with targetSize is not yet implemented in engine-image-node ' +
        '(track M2.2 follow-up)'
    );
  }

  const format = (rawFormat ?? 'webp') as ImageOutputFormat;
  const q = normalizeQuality(quality, 85);

  const srcBuffer = await blobToBuffer(blob);
  throwIfAborted(signal);

  // jpeg 输出时 sharp 默认用白底(无 alpha),与 engine-image 一致
  const pipeline = sharp(srcBuffer, { failOn: 'none' });
  if (format === 'jpeg') {
    pipeline.flatten({ background: '#ffffff' });
  }

  throwIfAborted(signal);
  return sharpToBlob(pipeline, toSharpFormat(format), q);
}

/**
 * Convert:转换格式。
 *
 * 与 engine-image convert 对齐:
 * - 必须指定 format(目标格式)
 * - jpeg 输出时用白底填充透明区域
 * - quality 默认 95(与 engine-image 一致)
 */
export async function convert(
  blob: Blob,
  params: Record<string, any>,
  signal?: AbortSignal
): Promise<Blob> {
  const sharp = (await import('sharp')).default;
  throwIfAborted(signal);

  const { format, quality } = params as ConvertParams;
  if (!format) {
    throw new Error('convert requires a "format" param');
  }
  const q = normalizeQuality(quality, 95);

  const srcBuffer = await blobToBuffer(blob);
  throwIfAborted(signal);

  const pipeline = sharp(srcBuffer, { failOn: 'none' });
  if (format === 'jpeg') {
    pipeline.flatten({ background: '#ffffff' });
  }

  throwIfAborted(signal);
  // convert 时使用源格式(已是目标格式),无需 inferFormat
  return sharpToBlob(pipeline, toSharpFormat(format), q);
}
