/**
 * 视觉效果操作(Node 引擎):background / filter
 *
 * 基于 sharp 的 flatten / modulate / grayscale / negate / blur 等 API 实现,
 * 与浏览器版 operations/filters.ts + background 操作对齐。
 *
 * 类型复用自 ../../types.js(问题 B:消除 engine-image-node 双源维护)。
 */
import type { BackgroundParams, FilterParams, FilterPreset } from '../../types.js';
import {
  blobToBuffer,
  inferFormat,
  sharpToBlob,
  throwIfAborted,
  toSharpFormat,
} from './utils.js';

/**
 * Background:替换/填充透明背景。
 *
 * 与浏览器版 background 操作对齐:
 * - 接受 { color }(CSS 颜色字符串)
 * - 将透明区域填充为指定颜色(flatten alpha 通道)
 *
 * sharp 的 .flatten({ background }) 将 alpha 通道合成到指定背景色上,
 * 输出不透明图像。
 */
export async function background(
  blob: Blob,
  params: Record<string, any>,
  signal?: AbortSignal
): Promise<Blob> {
  const sharp = (await import('sharp')).default;
  throwIfAborted(signal);

  const { color } = params as BackgroundParams;
  if (!color || typeof color !== 'string') {
    throw new Error('background requires a "color" param (CSS color string)');
  }

  const srcBuffer = await blobToBuffer(blob);
  throwIfAborted(signal);

  const pipeline = sharp(srcBuffer, { failOn: 'none' })
    .flatten({ background: color });

  throwIfAborted(signal);
  const format = inferFormat(blob, 'png');
  return sharpToBlob(pipeline, toSharpFormat(format), 95);
}

/**
 * 浏览器版支持的滤镜预设与 sharp 等价实现映射。
 *
 * - grayscale: sharp.grayscale()
 * - invert: sharp.negate()
 * - sepia: sharp 无原生 sepia,用 modulate + 色彩矩阵近似
 *   (libvips 的 recomb 可实现精确 sepia 矩阵)
 * - blur: sharp.blur(sigma)
 */
const SUPPORTED_FILTERS: FilterPreset[] = ['grayscale', 'invert', 'sepia', 'blur'];

/**
 * sepia 色彩矩阵(标准 NTSC sepia 变换)。
 * 通过 sharp.recomb() 应用 3x3 色彩矩阵实现。
 * 矩阵行:R_out, G_out, B_out 各由 R_in, G_in, B_in 线性组合。
 */
const SEPIA_MATRIX: [[number, number, number], [number, number, number], [number, number, number]] = [
  [0.393, 0.769, 0.189],
  [0.349, 0.686, 0.168],
  [0.272, 0.534, 0.131],
];

/**
 * Filter:应用预设滤镜。
 *
 * 与浏览器版 filter 对齐:
 * - preset: 'grayscale' | 'invert' | 'sepia' | 'blur'
 * - radius: blur 专用(模糊半径 px,默认 4)
 *
 * sharp 等价:
 * - grayscale → .grayscale()
 * - invert → .negate()
 * - sepia → .recomb(sepiaMatrix)(色彩矩阵变换)
 * - blur → .blur(sigma)(sigma ≈ radius * 0.5,高斯模糊)
 */
export async function filter(
  blob: Blob,
  params: Record<string, any>,
  signal?: AbortSignal
): Promise<Blob> {
  const sharp = (await import('sharp')).default;
  throwIfAborted(signal);

  const { preset, radius } = params as FilterParams;
  if (!preset || !SUPPORTED_FILTERS.includes(preset)) {
    const supported = SUPPORTED_FILTERS.join(', ');
    throw new Error(
      preset == null
        ? `Filter requires a "preset" param. Supported: ${supported}`
        : `Unknown filter preset: "${preset}". Supported: ${supported}`
    );
  }

  const srcBuffer = await blobToBuffer(blob);
  throwIfAborted(signal);

  let pipeline = sharp(srcBuffer, { failOn: 'none' });

  switch (preset) {
    case 'grayscale':
      pipeline = pipeline.grayscale();
      break;
    case 'invert':
      pipeline = pipeline.negate();
      break;
    case 'sepia':
      // recomb 接受 3x3 矩阵(行优先),将 RGB 通道线性变换为 sepia 色调
      pipeline = pipeline.recomb(SEPIA_MATRIX);
      break;
    case 'blur': {
      // 浏览器 CSS blur(Npx) 的 sigma ≈ N(高斯标准差)
      // sharp.blur(sigma) 接受 0.3-1000 的 sigma 值
      const sigma = Math.max(0.3, radius ?? 4);
      pipeline = pipeline.blur(sigma);
      break;
    }
  }

  throwIfAborted(signal);
  const format = inferFormat(blob, 'png');
  return sharpToBlob(pipeline, toSharpFormat(format), 95);
}
