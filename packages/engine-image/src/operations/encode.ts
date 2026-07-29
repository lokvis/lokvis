/**
 * 编码与格式操作:compress / convert / background
 *
 * 这组操作涉及格式转换与质量/背景控制,
 * 共享 inferFormat 与对透明通道的处理(PNG/JPEG 互转需填背景)。
 *
 * W3.5:接受可选 AbortSignal,在 decode / draw / encode 之间检查。
 *
 * W21.5:对 >4096px 的大图自动走 tile-based 路径(processLargeImageWithTiles),
 * 把 drawImage + encode 阶段切分到单个 tile,降低内存峰值。阈值由
 * shouldUseTiles(width, height) 判定,可在测试中通过传入小图 + 自定义阈值
 * 间接覆盖;此处保持常量以避免运行时配置引入复杂度。
 *
 * W21.6:bitmap 资源用 try/finally 释放,确保 throwIfAborted / encode
 * 抛错时 ImageBitmap 不会泄漏(浏览器 GC 不保证立即回收)。
 */
import type {
  BackgroundParams,
  CompressParams,
  ConvertParams,
  ImageOutputFormat,
} from '../types.js';
import { decodeImage, createCanvas, get2DContext } from '../canvas-engine.js';
import { inferFormat, throwIfAborted } from './utils.js';
import { compressToTargetSize } from './compress-target.js';
import { processLargeImageWithTiles, shouldUseTiles } from './tiles.js';
import { encodeSmart } from './wasm-encode.js';

/** Compress：压缩（同时可改变格式） */
export async function compress(
  blob: Blob,
  params: Record<string, any>,
  signal?: AbortSignal
): Promise<Blob> {
  const { format: rawFormat, quality, targetSize } = params as CompressParams;
  const format = (rawFormat ?? 'webp') as ImageOutputFormat;
  const q = quality ?? 85;

  if (targetSize) {
    return compressToTargetSize(blob, format, targetSize, signal);
  }

  const { bitmap, width, height } = await decodeImage(blob);
  try {
    throwIfAborted(signal);
    // W21.5: 大图走 tile 路径,绘制阶段峰值降到单 tile 级
    if (shouldUseTiles(width, height)) {
      return processLargeImageWithTiles(
        bitmap,
        width,
        height,
        format,
        q,
        // 每个 tile:drawImage 把源 bitmap 的对应区域绘制到 tile canvas(1:1,无缩放)
        (ctx, src, tile) => ctx.drawImage(src, tile.x, tile.y, tile.width, tile.height, 0, 0, tile.width, tile.height),
        signal
      );
    }
    const canvas = createCanvas(width, height);
    const ctx = get2DContext(canvas);
    ctx.drawImage(bitmap, 0, 0);
    throwIfAborted(signal);
    return encodeSmart(canvas, format, q, signal);
  } finally {
    bitmap.close?.();
  }
}

/** Convert：转换格式 */
export async function convert(
  blob: Blob,
  params: Record<string, any>,
  signal?: AbortSignal
): Promise<Blob> {
  const { format, quality } = params as ConvertParams;
  const q = quality ?? 95;
  const { bitmap, width, height } = await decodeImage(blob);
  try {
    throwIfAborted(signal);
    // W21.5: 大图走 tile 路径。JPEG 需填白底(透明通道转换),tile 绘制回调
    // 在每个 tile canvas 上先 fillRect 再 drawImage,与单 canvas 路径行为一致。
    if (shouldUseTiles(width, height)) {
      const needBg = format === 'jpeg';
      return processLargeImageWithTiles(
        bitmap,
        width,
        height,
        format,
        q,
        (ctx, src, tile) => {
          if (needBg) {
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, tile.width, tile.height);
          }
          ctx.drawImage(src, tile.x, tile.y, tile.width, tile.height, 0, 0, tile.width, tile.height);
        },
        signal
      );
    }
    const canvas = createCanvas(width, height);
    const ctx = get2DContext(canvas);
    if (format === 'jpeg') {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);
    }
    ctx.drawImage(bitmap, 0, 0);
    throwIfAborted(signal);
    return encodeSmart(canvas, format, q, signal);
  } finally {
    bitmap.close?.();
  }
}

/** Background：设置背景色（针对透明图片） */
export async function setBackground(
  blob: Blob,
  params: Record<string, any>,
  signal?: AbortSignal
): Promise<Blob> {
  const { color } = params as BackgroundParams;
  const { bitmap, width, height } = await decodeImage(blob);
  try {
    throwIfAborted(signal);
    const canvas = createCanvas(width, height);
    const ctx = get2DContext(canvas);
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(bitmap, 0, 0);
    throwIfAborted(signal);
    const format = inferFormat(blob, 'png');
    return encodeSmart(canvas, format, 95, signal);
  } finally {
    bitmap.close?.();
  }
}
