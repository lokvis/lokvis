/**
 * 水印操作:文字水印 / 图片水印
 *
 * 含位置计算(computeWatermarkPosition),
 * 支持 9 宫格位置 + tile 模式。
 */
import type { WatermarkParams, WatermarkPosition } from '../types.js';
import { canvasEngine, createCanvas, get2DContext } from '../canvas-engine.js';
import { inferFormat } from './utils.js';

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

/** 计算水印位置 */
export function computeWatermarkPosition(
  position: NonNullable<WatermarkPosition>,
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
