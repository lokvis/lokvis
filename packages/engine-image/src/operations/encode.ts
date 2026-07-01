/**
 * 编码与格式操作:compress / convert / background
 *
 * 这组操作涉及格式转换与质量/背景控制,
 * 共享 inferFormat 与对透明通道的处理(PNG/JPEG 互转需填背景)。
 */
import type {
  BackgroundParams,
  CompressParams,
  ConvertParams,
  ImageOutputFormat,
} from '../types.js';
import { canvasEngine, createCanvas, get2DContext } from '../canvas-engine.js';
import { inferFormat } from './utils.js';
import { compressToTargetSize } from './compress-target.js';

/** Compress：压缩（同时可改变格式） */
export async function compress(blob: Blob, params: CompressParams): Promise<Blob> {
  const format = (params.format ?? 'webp') as ImageOutputFormat;
  const quality = params.quality ?? 85;

  // 目标体积模式：二分查找最佳质量
  if (params.targetSize) {
    return compressToTargetSize(blob, format, params.targetSize);
  }

  const { bitmap, width, height } = await canvasEngine.decode(blob);
  const canvas = createCanvas(width, height);
  const ctx = get2DContext(canvas);
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close?.();
  return canvasEngine.encode(canvas, format, quality);
}

/** Convert：转换格式 */
export async function convert(blob: Blob, params: ConvertParams): Promise<Blob> {
  const { bitmap, width, height } = await canvasEngine.decode(blob);
  const canvas = createCanvas(width, height);
  const ctx = get2DContext(canvas);
  // PNG/JPEG 互转需要先填充背景，避免透明通道变黑
  if (params.format === 'jpeg') {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
  }
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close?.();
  return canvasEngine.encode(canvas, params.format, params.quality ?? 95);
}

/** Background：设置背景色（针对透明图片） */
export async function setBackground(
  blob: Blob,
  params: BackgroundParams
): Promise<Blob> {
  const { bitmap, width, height } = await canvasEngine.decode(blob);
  const canvas = createCanvas(width, height);
  const ctx = get2DContext(canvas);
  ctx.fillStyle = params.color;
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close?.();
  const format = inferFormat(blob, 'png');
  return canvasEngine.encode(canvas, format, 95);
}
