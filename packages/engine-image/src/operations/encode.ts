/**
 * 编码与格式操作:compress / convert / background
 *
 * 这组操作涉及格式转换与质量/背景控制,
 * 共享 inferFormat 与对透明通道的处理(PNG/JPEG 互转需填背景)。
 *
 * W3.5:接受可选 AbortSignal,在 decode / draw / encode 之间检查。
 */
import type {
  BackgroundParams,
  CompressParams,
  ConvertParams,
  ImageOutputFormat,
} from '../types.js';
import { canvasEngine, createCanvas, get2DContext } from '../canvas-engine.js';
import { inferFormat, throwIfAborted } from './utils.js';
import { compressToTargetSize } from './compress-target.js';

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

  const { bitmap, width, height } = await canvasEngine.decode(blob);
  throwIfAborted(signal);
  const canvas = createCanvas(width, height);
  const ctx = get2DContext(canvas);
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close?.();
  throwIfAborted(signal);
  return canvasEngine.encode(canvas, format, q);
}

/** Convert：转换格式 */
export async function convert(
  blob: Blob,
  params: Record<string, any>,
  signal?: AbortSignal
): Promise<Blob> {
  const { format, quality } = params as ConvertParams;
  const { bitmap, width, height } = await canvasEngine.decode(blob);
  throwIfAborted(signal);
  const canvas = createCanvas(width, height);
  const ctx = get2DContext(canvas);
  if (format === 'jpeg') {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
  }
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close?.();
  throwIfAborted(signal);
  return canvasEngine.encode(canvas, format, quality ?? 95);
}

/** Background：设置背景色（针对透明图片） */
export async function setBackground(
  blob: Blob,
  params: Record<string, any>,
  signal?: AbortSignal
): Promise<Blob> {
  const { color } = params as BackgroundParams;
  const { bitmap, width, height } = await canvasEngine.decode(blob);
  throwIfAborted(signal);
  const canvas = createCanvas(width, height);
  const ctx = get2DContext(canvas);
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close?.();
  throwIfAborted(signal);
  const format = inferFormat(blob, 'png');
  return canvasEngine.encode(canvas, format, 95);
}
