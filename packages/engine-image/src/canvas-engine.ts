/**
 * 浏览器原生 Canvas 图像引擎
 *
 * MVP 首选引擎：零 WASM 依赖，首屏最快。
 * 通过 createImageBitmap 解码，Canvas 2D 处理，canvas.toBlob 编码。
 *
 * 局限：AVIF 编码浏览器支持不全；编码质量略逊于 Squoosh WASM。
 * 后续可通过同一适配层无缝切换到 Squoosh。
 */

import type {
  CompressParams,
  ConvertParams,
  DecodedImage,
  ImageEngineAdapter,
  ImageOutputFormat,
} from './types.js';

export const CANVAS_ENGINE_VERSION = '0.1.0';

/** MIME 类型映射 */
const MIME_BY_FORMAT: Record<ImageOutputFormat, string> = {
  png: 'image/png',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  avif: 'image/avif',
  gif: 'image/gif',
};

/** Canvas 引擎实现 */
export const canvasEngine: ImageEngineAdapter = {
  name: 'canvas',
  version: CANVAS_ENGINE_VERSION,
  supportedCapabilities: [
    'image.resize',
    'image.compress',
    'image.convert',
    'image.crop',
    'image.rotate',
    'image.flip',
    'image.watermark',
    'image.background',
    'image.filter',
  ],

  async isSupported() {
    // Canvas 引擎在任何现代浏览器都可用
    return (
      typeof OffscreenCanvas !== 'undefined' ||
      typeof document !== 'undefined'
    );
  },

  async decode(blob: Blob): Promise<DecodedImage> {
    if (typeof createImageBitmap !== 'function') {
      throw new Error('createImageBitmap is not supported in this environment');
    }
    const bitmap = await createImageBitmap(blob);
    return {
      bitmap,
      width: bitmap.width,
      height: bitmap.height,
    };
  },

  async encode(
    canvas: HTMLCanvasElement | OffscreenCanvas,
    format: ImageOutputFormat,
    quality = 90
  ): Promise<Blob> {
    const mime = MIME_BY_FORMAT[format] ?? 'image/png';
    const q = Math.min(1, Math.max(0, quality / 100));

    if (canvas instanceof OffscreenCanvas) {
      return canvas.convertToBlob({ type: mime, quality: q });
    }
    return new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error(`Failed to encode canvas as ${format}`));
        },
        mime,
        q
      );
    });
  },
};

/** 检测浏览器对各种图像编码格式的支持 */
export async function detectFormatSupport(): Promise<Record<ImageOutputFormat, boolean>> {
  const testCanvas =
    typeof OffscreenCanvas !== 'undefined'
      ? new OffscreenCanvas(1, 1)
      : document.createElement('canvas');
  const results: Record<ImageOutputFormat, boolean> = {
    png: true,
    jpeg: true,
    webp: false,
    avif: false,
    gif: false,
  };

  for (const fmt of ['webp', 'avif'] as ImageOutputFormat[]) {
    try {
      const blob = await canvasEngine.encode(testCanvas, fmt, 80);
      // 检查实际产出 MIME
      results[fmt] = blob.type === MIME_BY_FORMAT[fmt] || blob.size > 0;
    } catch {
      results[fmt] = false;
    }
  }
  return results;
}

/** 便捷：直接从 Blob 解码并执行一次编码（用于纯格式转换） */
export async function reencode(
  blob: Blob,
  params: CompressParams | ConvertParams
): Promise<Blob> {
  const { bitmap, width, height } = await canvasEngine.decode(blob);
  const canvas = createCanvas(width, height);
  const ctx = get2DContext(canvas);
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close?.();
  const format = (params.format ?? 'webp') as ImageOutputFormat;
  const quality = params.quality ?? 90;
  return canvasEngine.encode(canvas, format, quality);
}

/**
 * 解码并直接缩放到目标尺寸(W3.2 大图内存优化)。
 *
 * 使用 createImageBitmap 的 resizeWidth/resizeHeight 选项,在解码阶段
 * 就缩放,避免先 decode 全分辨率 bitmap 再缩放——后者会短暂持有全分辨率
 * 位图(对超大图是 OOM 风险点)。这是 canvas 引擎最大的单点内存优化。
 *
 * 仅对"缩小"有意义(target < source);放大时行为等同普通 decode 后再缩放。
 * 兼容性:createImageBitmap resize 选项在 Chrome/Edge/Firefox 现代版本可用,
 * Safari 16.4+ 支持;不支持(抛错)时回退到普通 decode + drawImage 缩放。
 *
 * @param blob 输入图
 * @param targetWidth 目标宽(像素)
 * @param targetHeight 目标高(像素)
 */
export async function decodeResized(
  blob: Blob,
  targetWidth: number,
  targetHeight: number
): Promise<DecodedImage> {
  if (typeof createImageBitmap !== 'function') {
    throw new Error('createImageBitmap is not supported in this environment');
  }
  try {
    const bitmap = await createImageBitmap(blob, {
      resizeWidth: targetWidth,
      resizeHeight: targetHeight,
      resizeQuality: 'high',
    });
    return { bitmap, width: bitmap.width, height: bitmap.height };
  } catch {
    // 回退:不支持 resize 选项 → 普通 decode 后由调用方 drawImage 缩放
    return canvasEngine.decode(blob);
  }
}

/** 创建 Canvas（优先 OffscreenCanvas，回退到 DOM Canvas） */
export function createCanvas(
  width: number,
  height: number
): HTMLCanvasElement | OffscreenCanvas {
  if (typeof OffscreenCanvas !== 'undefined') {
    return new OffscreenCanvas(width, height);
  }
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

/** Canvas 2D Context 类型（兼容 OffscreenCanvas 与 HTMLCanvasElement） */
export type Canvas2DContext =
  | CanvasRenderingContext2D
  | OffscreenCanvasRenderingContext2D;

/** 获取 Canvas 的 2D Context（类型断言版） */
export function get2DContext(
  canvas: HTMLCanvasElement | OffscreenCanvas
): Canvas2DContext {
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Failed to get 2D context from canvas');
  }
  return ctx as Canvas2DContext;
}
