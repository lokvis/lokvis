/**
 * 简单滤镜:grayscale / invert / sepia / blur
 *
 * 基于 Canvas 2D filter 属性实现,浏览器原生支持,
 * 性能优于逐像素操作。
 */
import type { FilterParams, FilterPreset } from '../types.js';
import { canvasEngine, createCanvas, get2DContext } from '../canvas-engine.js';
import { inferFormat } from './utils.js';

const CSS_FILTERS: Record<FilterPreset, (radius?: number) => string> = {
  grayscale: () => 'grayscale(100%)',
  invert: () => 'invert(100%)',
  sepia: () => 'sepia(100%)',
  blur: (radius) => `blur(${radius ?? 4}px)`,
};

/** Filter：应用预设滤镜 */
export async function filter(
  blob: Blob,
  params: Record<string, any>
): Promise<Blob> {
  const { preset, radius } = params as FilterParams;
  if (!preset || !(preset in CSS_FILTERS)) {
    const supported = Object.keys(CSS_FILTERS).join(', ');
    throw new Error(
      preset == null
        ? `Filter requires a "preset" param. Supported: ${supported}`
        : `Unknown filter preset: "${preset}". Supported: ${supported}`
    );
  }

  const { bitmap, width, height } = await canvasEngine.decode(blob);
  const canvas = createCanvas(width, height);
  const ctx = get2DContext(canvas);
  ctx.filter = CSS_FILTERS[preset](radius);
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close?.();

  const format = inferFormat(blob, 'png');
  return canvasEngine.encode(canvas, format, 95);
}
