/**
 * 几何变换操作:resize / crop / rotate / flip
 *
 * 这组操作共享 computeTargetSize / inferFormat 工具,
 * 都基于 Canvas 的 drawImage / translate / rotate / scale 实现。
 */
import type {
  CropParams,
  FlipParams,
  ResizeParams,
  RotateParams,
} from '../types.js';
import { canvasEngine, createCanvas, get2DContext } from '../canvas-engine.js';
import { computeTargetSize, inferFormat } from './utils.js';

/** Resize：调整尺寸 */
export async function resize(blob: Blob, params: Record<string, any>): Promise<Blob> {
  const { bitmap, width: srcW, height: srcH } = await canvasEngine.decode(blob);
  const target = computeTargetSize(srcW, srcH, params as ResizeParams);
  const canvas = createCanvas(target.width, target.height);
  const ctx = get2DContext(canvas);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, 0, 0, target.width, target.height);
  bitmap.close?.();
  const format = inferFormat(blob, 'png');
  return canvasEngine.encode(canvas, format, 95);
}

/** Crop：裁剪 */
export async function crop(blob: Blob, params: Record<string, any>): Promise<Blob> {
  const { x, y, width, height } = params as CropParams;
  const { bitmap } = await canvasEngine.decode(blob);
  const canvas = createCanvas(width, height);
  const ctx = get2DContext(canvas);
  ctx.drawImage(bitmap, x, y, width, height, 0, 0, width, height);
  bitmap.close?.();
  const format = inferFormat(blob, 'png');
  return canvasEngine.encode(canvas, format, 95);
}

/** Rotate：旋转 */
export async function rotate(blob: Blob, params: Record<string, any>): Promise<Blob> {
  const { angle: rawAngle, background } = params as RotateParams;
  const { bitmap, width, height } = await canvasEngine.decode(blob);
  const angle = ((rawAngle % 360) + 360) % 360;
  const swap = angle === 90 || angle === 270;
  const outW = swap ? height : width;
  const outH = swap ? width : height;
  const canvas = createCanvas(outW, outH);
  const ctx = get2DContext(canvas);
  ctx.fillStyle = background ?? '#ffffff';
  ctx.fillRect(0, 0, outW, outH);
  ctx.translate(outW / 2, outH / 2);
  ctx.rotate((angle * Math.PI) / 180);
  ctx.drawImage(bitmap, -width / 2, -height / 2);
  bitmap.close?.();
  const format = inferFormat(blob, 'png');
  return canvasEngine.encode(canvas, format, 95);
}

/** Flip：翻转 */
export async function flip(blob: Blob, params: Record<string, any>): Promise<Blob> {
  const { axis } = params as FlipParams;
  const { bitmap, width, height } = await canvasEngine.decode(blob);
  const canvas = createCanvas(width, height);
  const ctx = get2DContext(canvas);
  ctx.translate(
    axis === 'horizontal' || axis === 'both' ? width : 0,
    axis === 'vertical' || axis === 'both' ? height : 0
  );
  ctx.scale(
    axis === 'horizontal' || axis === 'both' ? -1 : 1,
    axis === 'vertical' || axis === 'both' ? -1 : 1
  );
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close?.();
  const format = inferFormat(blob, 'png');
  return canvasEngine.encode(canvas, format, 95);
}
