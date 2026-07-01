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
export async function resize(blob: Blob, params: ResizeParams): Promise<Blob> {
  const { bitmap, width: srcW, height: srcH } = await canvasEngine.decode(blob);
  const target = computeTargetSize(srcW, srcH, params);
  const canvas = createCanvas(target.width, target.height);
  const ctx = get2DContext(canvas);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, 0, 0, target.width, target.height);
  bitmap.close?.();
  // Resize 不改变格式，保持原格式（PNG/JPEG/WebP），但 PNG 优先保证无损
  const format = inferFormat(blob, 'png');
  return canvasEngine.encode(canvas, format, 95);
}

/** Crop：裁剪 */
export async function crop(blob: Blob, params: CropParams): Promise<Blob> {
  const { bitmap } = await canvasEngine.decode(blob);
  const canvas = createCanvas(params.width, params.height);
  const ctx = get2DContext(canvas);
  ctx.drawImage(
    bitmap,
    params.x,
    params.y,
    params.width,
    params.height,
    0,
    0,
    params.width,
    params.height
  );
  bitmap.close?.();
  const format = inferFormat(blob, 'png');
  return canvasEngine.encode(canvas, format, 95);
}

/** Rotate：旋转 */
export async function rotate(blob: Blob, params: RotateParams): Promise<Blob> {
  const { bitmap, width, height } = await canvasEngine.decode(blob);
  const angle = ((params.angle % 360) + 360) % 360;
  // 90/270 度旋转需要交换宽高
  const swap = angle === 90 || angle === 270;
  const outW = swap ? height : width;
  const outH = swap ? width : height;
  const canvas = createCanvas(outW, outH);
  const ctx = get2DContext(canvas);
  ctx.fillStyle = params.background ?? '#ffffff';
  ctx.fillRect(0, 0, outW, outH);
  ctx.translate(outW / 2, outH / 2);
  ctx.rotate((angle * Math.PI) / 180);
  ctx.drawImage(bitmap, -width / 2, -height / 2);
  bitmap.close?.();
  const format = inferFormat(blob, 'png');
  return canvasEngine.encode(canvas, format, 95);
}

/** Flip：翻转 */
export async function flip(blob: Blob, params: FlipParams): Promise<Blob> {
  const { bitmap, width, height } = await canvasEngine.decode(blob);
  const canvas = createCanvas(width, height);
  const ctx = get2DContext(canvas);
  ctx.translate(
    params.axis === 'horizontal' || params.axis === 'both' ? width : 0,
    params.axis === 'vertical' || params.axis === 'both' ? height : 0
  );
  ctx.scale(
    params.axis === 'horizontal' || params.axis === 'both' ? -1 : 1,
    params.axis === 'vertical' || params.axis === 'both' ? -1 : 1
  );
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close?.();
  const format = inferFormat(blob, 'png');
  return canvasEngine.encode(canvas, format, 95);
}
