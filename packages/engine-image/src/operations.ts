/**
 * 图像操作实现
 *
 * 每个操作接收 Blob 输入 + 参数，返回 Blob 输出。
 * Plugin 通过 CapabilityImplementation 调用这些函数。
 */

import type {
  BackgroundParams,
  CompressParams,
  ConvertParams,
  CropParams,
  DecodedImage,
  FlipParams,
  ImageOutputFormat,
  ResizeParams,
  RotateParams,
  WatermarkParams,
} from './types.js';
import { canvasEngine, createCanvas, get2DContext } from './canvas-engine.js';

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
  const format: ImageOutputFormat = inferFormat(blob, 'png');
  return canvasEngine.encode(canvas, format, 95);
}

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

/** Watermark：水印 */
export async function watermark(
  blob: Blob,
  params: WatermarkParams
): Promise<Blob> {
  const { bitmap, width, height } = await canvasEngine.decode(blob);
  const canvas = createCanvas(width, height);
  const ctx = get2DContext(canvas);
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close?.();

  const opacity = params.opacity ?? 0.8;
  ctx.globalAlpha = opacity;

  if (params.image) {
    // 图片水印
    const wmBlob = await (await fetch(params.image)).blob();
    const wmBitmap = await createImageBitmap(wmBlob);
    const wmW = wmBitmap.width;
    const wmH = wmBitmap.height;
    const pos = computeWatermarkPosition(
      params.position ?? 'bottom-right',
      width,
      height,
      wmW,
      wmH
    );
    ctx.drawImage(wmBitmap, pos.x, pos.y, wmW, wmH);
    wmBitmap.close?.();
  } else if (params.text) {
    // 文字水印
    const fontSize = params.fontSize ?? 24;
    ctx.font = `${fontSize}px sans-serif`;
    ctx.fillStyle = params.color ?? '#ffffff';
    ctx.textBaseline = 'top';
    const metrics = ctx.measureText(params.text);
    const pos = computeWatermarkPosition(
      params.position ?? 'bottom-right',
      width,
      height,
      metrics.width,
      fontSize
    );
    ctx.fillText(params.text, pos.x, pos.y);
  }
  ctx.globalAlpha = 1;

  const format = inferFormat(blob, 'png');
  return canvasEngine.encode(canvas, format, 95);
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

// ─── 内部工具 ─────────────────────────────────────────────

/** 计算目标尺寸（考虑 fit 策略与宽高比） */
function computeTargetSize(
  srcW: number,
  srcH: number,
  params: ResizeParams
): { width: number; height: number } {
  const fit = params.fit ?? 'cover';
  const maintain = params.maintainAspectRatio ?? true;
  const targetW = params.width;
  const targetH = params.height;

  // 既未指定 width 也未指定 height：保持原尺寸
  if (!targetW && !targetH) {
    return { width: srcW, height: srcH };
  }

  // 只指定一边：按比例缩放
  if (targetW && !targetH) {
    return maintain
      ? { width: targetW, height: Math.round((srcH * targetW) / srcW) }
      : { width: targetW, height: srcH };
  }
  if (!targetW && targetH) {
    return maintain
      ? { width: Math.round((srcW * targetH) / srcH), height: targetH }
      : { width: srcW, height: targetH };
  }

  // 两边都指定
  const w = targetW!;
  const h = targetH!;
  if (!maintain || fit === 'fill') {
    return { width: w, height: h };
  }
  const srcRatio = srcW / srcH;
  const targetRatio = w / h;
  if (fit === 'cover') {
    return targetRatio > srcRatio
      ? { width: w, height: Math.round(w / srcRatio) }
      : { width: Math.round(h * srcRatio), height: h };
  }
  // contain / inside
  return targetRatio > srcRatio
    ? { width: Math.round(h * srcRatio), height: h }
    : { width: w, height: Math.round(w / srcRatio) };
}

/** 从 Blob 推断原始格式，回退到默认格式 */
function inferFormat(blob: Blob, fallback: ImageOutputFormat): ImageOutputFormat {
  const mime = blob.type.toLowerCase();
  if (mime === 'image/png') return 'png';
  if (mime === 'image/jpeg') return 'jpeg';
  if (mime === 'image/webp') return 'webp';
  if (mime === 'image/avif') return 'avif';
  if (mime === 'image/gif') return 'gif';
  return fallback;
}

/** 计算水印位置 */
function computeWatermarkPosition(
  position: NonNullable<WatermarkParams['position']>,
  canvasW: number,
  canvasH: number,
  wmW: number,
  wmH: number
): { x: number; y: number } {
  const margin = 16;
  switch (position) {
    case 'top-left':
      return { x: margin, y: margin };
    case 'top-right':
      return { x: canvasW - wmW - margin, y: margin };
    case 'bottom-left':
      return { x: margin, y: canvasH - wmH - margin };
    case 'bottom-right':
      return { x: canvasW - wmW - margin, y: canvasH - wmH - margin };
    case 'center':
      return { x: (canvasW - wmW) / 2, y: (canvasH - wmH) / 2 };
    case 'tile':
      // tile 模式由调用方处理，这里返回第一个 tile
      return { x: margin, y: margin };
    default:
      return { x: margin, y: margin };
  }
}

/** 目标体积压缩：二分查找质量 */
async function compressToTargetSize(
  blob: Blob,
  format: ImageOutputFormat,
  targetSize: number
): Promise<Blob> {
  const { bitmap, width, height } = await canvasEngine.decode(blob);
  const canvas = createCanvas(width, height);
  const ctx = get2DContext(canvas);
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close?.();

  let lo = 10;
  let hi = 95;
  let best: Blob | null = null;
  for (let i = 0; i < 6; i++) {
    const mid = Math.floor((lo + hi) / 2);
    const candidate = await canvasEngine.encode(canvas, format, mid);
    if (candidate.size <= targetSize) {
      best = candidate;
      lo = mid + 1; // 尝试更高质量
    } else {
      hi = mid - 1;
    }
  }
  // 如果所有质量都超目标，返回最低质量结果
  if (!best) {
    best = await canvasEngine.encode(canvas, format, lo);
  }
  return best;
}

/** 解码图像元数据（不保留 bitmap） */
export async function probe(blob: Blob): Promise<DecodedImage> {
  return canvasEngine.decode(blob);
}
