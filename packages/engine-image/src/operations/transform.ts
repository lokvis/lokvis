/**
 * 几何变换操作:resize / crop / rotate / flip
 *
 * 这组操作共享 computeTargetSize / inferFormat 工具,
 * 都基于 Canvas 的 drawImage / translate / rotate / scale 实现。
 *
 * W3.5:每个操作接受可选 AbortSignal,在 decode / draw / encode 之间检查,
 * 使 cancel() 在长耗时的 canvas 编码阶段也能及时生效。
 *
 * W21.6:bitmap 资源用 try/finally 释放,确保 throwIfAborted / encode
 * 抛错时 ImageBitmap 不会泄漏(浏览器 GC 不保证立即回收)。
 */
import type {
  CropParams,
  FlipParams,
  ResizeParams,
  RotateParams,
} from '../types.js';
import { canvasEngine, createCanvas, get2DContext } from '../canvas-engine.js';
import { computeTargetSize, inferFormat, throwIfAborted } from './utils.js';
import { embedPngDpi } from './png-metadata.js';
import { encodeSmart } from './wasm-encode.js';

/**
 * Resize：调整尺寸
 *
 * W3.2 备注:canvas 引擎的 createImageBitmap 一次性全量解码,无法在解码
 * 阶段就按目标尺寸缩放(需先 decode 拿到源图比例才能算目标,陷入循环)。
 * 因此 resize 走标准的 decode → computeTargetSize → drawImage 缩放路径。
 * 大图缩小的单点内存优化(createImageBitmap resize 选项)留给未来"显式
 * maxEdge"型 API 或 WASM 引擎使用(见 canvas-engine.decodeResized)。
 * W3.2 真正落地的是分片基础设施(tiles.ts:splitIntoTiles / mergeChunks),
 * 供流式流水线按 tile 处理 + 中间结果溢出 OPFS。
 */
export async function resize(
  blob: Blob,
  params: Record<string, any>,
  signal?: AbortSignal
): Promise<Blob> {
  const { bitmap, width: srcW, height: srcH } = await canvasEngine.decode(blob);
  try {
    throwIfAborted(signal);
    const p = params as ResizeParams;
    const target = computeTargetSize(srcW, srcH, p);

    // cover 且两边都指定时,computeTargetSize 返回的是"覆盖目标框的缩放尺寸"
    // (保留源比例、尺寸 ≥ 目标框)。真正的输出需再居中裁切到精确目标框,
    // 与 sharp fit:'cover' / CSS object-fit:cover 语义一致。
    // 修复前只缩放不裁切,横图 + 竖版预设(如 TikTok 9:16)会输出源图比例。
    const fit = p.fit ?? 'cover';
    const maintain = p.maintainAspectRatio ?? true;
    const isCoverCrop =
      fit === 'cover' &&
      maintain &&
      p.width != null &&
      p.height != null &&
      (target.width !== p.width || target.height !== p.height);

    let canvas: HTMLCanvasElement | OffscreenCanvas;
    if (isCoverCrop) {
      const outW = p.width!;
      const outH = p.height!;
      // 按 cover 缩放反推源图上的居中裁切区域
      const scale = Math.max(outW / srcW, outH / srcH);
      const cropW = outW / scale;
      const cropH = outH / scale;
      const sx = (srcW - cropW) / 2;
      const sy = (srcH - cropH) / 2;
      canvas = createCanvas(outW, outH);
      const ctx = get2DContext(canvas);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(bitmap, sx, sy, cropW, cropH, 0, 0, outW, outH);
    } else {
      canvas = createCanvas(target.width, target.height);
      const ctx = get2DContext(canvas);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(bitmap, 0, 0, target.width, target.height);
    }

    throwIfAborted(signal);
    const format = inferFormat(blob, 'png');
    const out = await encodeSmart(canvas, format, 95, signal);
    // W8.4:把 DPI 写入 PNG pHYs chunk,供打印软件读取。
    // 仅 PNG 生效;canvas encode 不写物理分辨率,这里补写。
    const { dpi } = p;
    if (format === 'png' && typeof dpi === 'number' && dpi > 0) {
      return embedPngDpi(out, dpi);
    }
    return out;
  } finally {
    // W21.6: 确保异常路径(throwIfAborted / encode 抛错)也释放 bitmap
    bitmap.close?.();
  }
}

/** Crop：裁剪 */
export async function crop(
  blob: Blob,
  params: Record<string, any>,
  signal?: AbortSignal
): Promise<Blob> {
  const { x, y, width, height } = params as CropParams;
  const { bitmap } = await canvasEngine.decode(blob);
  try {
    throwIfAborted(signal);
    const canvas = createCanvas(width, height);
    const ctx = get2DContext(canvas);
    ctx.drawImage(bitmap, x, y, width, height, 0, 0, width, height);
    throwIfAborted(signal);
    const format = inferFormat(blob, 'png');
    return encodeSmart(canvas, format, 95, signal);
  } finally {
    bitmap.close?.();
  }
}

/** Rotate：旋转 */
export async function rotate(
  blob: Blob,
  params: Record<string, any>,
  signal?: AbortSignal
): Promise<Blob> {
  const { angle: rawAngle, background } = params as RotateParams;
  const { bitmap, width, height } = await canvasEngine.decode(blob);
  try {
    throwIfAborted(signal);
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
    throwIfAborted(signal);
    const format = inferFormat(blob, 'png');
    return encodeSmart(canvas, format, 95, signal);
  } finally {
    bitmap.close?.();
  }
}

/** Flip：翻转 */
export async function flip(
  blob: Blob,
  params: Record<string, any>,
  signal?: AbortSignal
): Promise<Blob> {
  const { axis } = params as FlipParams;
  const { bitmap, width, height } = await canvasEngine.decode(blob);
  try {
    throwIfAborted(signal);
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
    throwIfAborted(signal);
    const format = inferFormat(blob, 'png');
    return encodeSmart(canvas, format, 95, signal);
  } finally {
    bitmap.close?.();
  }
}
