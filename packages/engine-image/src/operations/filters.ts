/**
 * 简单滤镜:grayscale / invert / sepia / blur
 *
 * 基于 Canvas 2D filter 属性实现,浏览器原生支持,
 * 性能优于逐像素操作。
 *
 * W3.5:接受可选 AbortSignal,在 decode / draw / encode 之间检查。
 *
 * W21.6:bitmap 资源用 try/finally 释放,确保 throwIfAborted / encode
 * 抛错时 ImageBitmap 不会泄漏。
 */
import type { FilterParams, FilterPreset } from '../types.js';
import { canvasEngine, createCanvas, get2DContext } from '../canvas-engine.js';
import { inferFormat, throwIfAborted } from './utils.js';
import { encodeSmart } from './wasm-encode.js';

const CSS_FILTERS: Record<FilterPreset, (radius?: number) => string> = {
  grayscale: () => 'grayscale(100%)',
  invert: () => 'invert(100%)',
  sepia: () => 'sepia(100%)',
  blur: (radius) => `blur(${radius ?? 4}px)`,
};

/** Filter：应用预设滤镜 */
export async function filter(
  blob: Blob,
  params: Record<string, any>,
  signal?: AbortSignal
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
  try {
    throwIfAborted(signal);
    const canvas = createCanvas(width, height);
    const ctx = get2DContext(canvas);
    ctx.filter = CSS_FILTERS[preset](radius);
    ctx.drawImage(bitmap, 0, 0);
    throwIfAborted(signal);

    const format = inferFormat(blob, 'png');
    return encodeSmart(canvas, format, 95, signal);
  } finally {
    bitmap.close?.();
  }
}
