/**
 * 编码与格式操作:compress / convert
 *
 * 基于 sharp 的 toFormat + quality 实现,
 * 与浏览器版 operations/encode.ts 同名操作对齐。
 *
 * 注意:
 * - targetSize(目标体积压缩)通过二分查找 [10, 95] 质量区间实现,
 *   与浏览器版 compressToTargetSize 算法一致(最多 6 次迭代)
 * - convert 时若输出为 jpeg,sharp 自动用白底填充透明区域
 *   (与浏览器版 convert 一致)
 *
 * 类型复用自 ../../types.js(问题 B:消除 engine-image-node 双源维护)。
 */
import type { CompressParams, ConvertParams, ImageOutputFormat } from '../../types.js';
import {
  blobToBuffer,
  bufferToBlobPart,
  normalizeQuality,
  sharpToBlob,
  throwIfAborted,
  toSharpFormat,
} from './utils.js';

/**
 * 目标体积压缩:二分查找最佳质量(与浏览器版 compressToTargetSize 对齐)。
 *
 * 算法:在 [10, 95] 区间二分查找满足 targetSize 的最大质量,
 * 最多迭代 6 次(平衡精度与耗时)。每轮检查 AbortSignal。
 */
async function compressToTargetSize(
  srcBuffer: Buffer,
  format: ImageOutputFormat,
  targetSize: number,
  signal?: AbortSignal
): Promise<Blob> {
  const sharp = (await import('sharp')).default;
  let lo = 10;
  let hi = 95;
  let best: Buffer | null = null;

  for (let i = 0; i < 6 && lo <= hi; i++) {
    throwIfAborted(signal);
    const mid = Math.floor((lo + hi) / 2);
    const pipeline = sharp(srcBuffer, { failOn: 'none' });
    if (format === 'jpeg') {
      pipeline.flatten({ background: '#ffffff' });
    }
    const candidate = await pipeline.toFormat(format, { quality: mid }).toBuffer();
    if (candidate.length <= targetSize) {
      best = candidate;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }

  // 所有质量都超目标时,返回最低质量结果
  if (!best) {
    throwIfAborted(signal);
    const pipeline = sharp(srcBuffer, { failOn: 'none' });
    if (format === 'jpeg') {
      pipeline.flatten({ background: '#ffffff' });
    }
    best = await pipeline.toFormat(format, { quality: 10 }).toBuffer();
  }

  throwIfAborted(signal);
  return new Blob([bufferToBlobPart(best)], {
    type: `image/${format === 'jpeg' ? 'jpeg' : format}`,
  });
}

/**
 * Compress:压缩(可同时改变格式)。
 *
 * 与浏览器版 compress 对齐:
 * - 默认输出 webp(quality 85),与浏览器版一致
 * - targetSize 通过二分查找 [10, 95] 质量区间实现
 */
export async function compress(
  blob: Blob,
  params: Record<string, any>,
  signal?: AbortSignal
): Promise<Blob> {
  const sharp = (await import('sharp')).default;
  throwIfAborted(signal);

  const { format: rawFormat, quality, targetSize } = params as CompressParams;
  const format = (rawFormat ?? 'webp') as ImageOutputFormat;

  const srcBuffer = await blobToBuffer(blob);
  throwIfAborted(signal);

  // targetSize 模式:二分查找最佳质量
  if (targetSize) {
    return compressToTargetSize(srcBuffer, format, targetSize, signal);
  }

  const q = normalizeQuality(quality, 85);

  // jpeg 输出时 sharp 默认用白底(无 alpha),与浏览器版一致
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
 * 与浏览器版 convert 对齐:
 * - 必须指定 format(目标格式)
 * - jpeg 输出时用白底填充透明区域
 * - quality 默认 95(与浏览器版一致)
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
