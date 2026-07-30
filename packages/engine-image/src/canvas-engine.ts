/**
 * 浏览器原生 Canvas 图像引擎
 *
 * MVP 首选引擎：零 WASM 依赖，首屏最快。
 * 通过 createImageBitmap 解码，Canvas 2D 处理，canvas.toBlob 编码。
 *
 * ADR-015:原生 API 原语(OffscreenCanvas / document.createElement /
 * toBlob / convertToBlob / createImageBitmap)收敛到 @lokvis/browser-adapter,
 * 本模块只保留引擎业务语义(MIME 映射、静默回退判错、resize 降级策略)。
 *
 * 局限：AVIF 编码浏览器支持不全；编码质量略逊于 Squoosh WASM。
 * 后续可通过同一适配层无缝切换到 Squoosh。
 */

import {
  createCanvas,
  decodeToBitmap,
  detectEncodeSupport,
  encodeCanvasToBlob,
  get2DContext,
} from '@lokvis/browser-adapter';
import type {
  CompressParams,
  ConvertParams,
  DecodedImage,
  ImageEngineDescriptor,
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

/**
 * Canvas 图像引擎描述符。
 *
 * 与 engine-pdf 的 PDF_ENGINE / engine-video 的 VIDEO_ENGINE 对齐:仅承载元数据,
 * 供 plugin-image 单点推导 engine 级 stub 状态。实际操作是本模块的独立纯函数
 * (decodeImage / encodeImage)与 operations/* 下的各能力函数。
 */
export const IMAGE_ENGINE: ImageEngineDescriptor = {
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
    'image.favicon',
  ],
};

/** 解码 Blob 为位图与尺寸(createImageBitmap,经 adapter) */
export async function decodeImage(blob: Blob): Promise<DecodedImage> {
  const bitmap = await decodeToBitmap(blob);
  return {
    bitmap,
    width: bitmap.width,
    height: bitmap.height,
  };
}

/** 将 Canvas 编码为指定格式的 Blob(quality 0-100) */
export async function encodeImage(
  canvas: HTMLCanvasElement | OffscreenCanvas,
  format: ImageOutputFormat,
  quality = 90
): Promise<Blob> {
  const mime = MIME_BY_FORMAT[format];
  if (!mime) {
    throw new Error(
      `Unsupported image format: '${format}'. Supported formats: ${Object.keys(MIME_BY_FORMAT).join(', ')}.`
    );
  }
  const q = Math.min(1, Math.max(0, quality / 100));
  const blob = await encodeCanvasToBlob(canvas, mime, q);

  // 浏览器缺少对应编码器时(如 AVIF),toBlob / convertToBlob 会按规范
  // 静默回退为 PNG。比对实际产出 MIME,避免把错误格式静默交给上层
  // (用户选 AVIF 却得到 PNG)。上层应先用 detectFormatSupport 门控。
  if (blob.type !== mime) {
    throw new Error(
      `This browser does not support encoding '${format}' (produced '${blob.type || 'unknown'}' instead).`
    );
  }
  return blob;
}

/** 检测浏览器对各种图像编码格式的支持(经 adapter FormatSupportProbe) */
export async function detectFormatSupport(): Promise<Record<ImageOutputFormat, boolean>> {
  const support = await detectEncodeSupport(Object.keys(MIME_BY_FORMAT));
  return support as Record<ImageOutputFormat, boolean>;
}

/** 便捷：直接从 Blob 解码并执行一次编码（用于纯格式转换） */
export async function reencode(
  blob: Blob,
  params: CompressParams | ConvertParams
): Promise<Blob> {
  const { bitmap, width, height } = await decodeImage(blob);
  const canvas = createCanvas(width, height);
  const ctx = get2DContext(canvas);
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close?.();
  const format = (params.format ?? 'webp') as ImageOutputFormat;
  const quality = params.quality ?? 90;
  return encodeImage(canvas, format, quality);
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
  try {
    const bitmap = await decodeToBitmap(blob, {
      width: targetWidth,
      height: targetHeight,
    });
    return { bitmap, width: bitmap.width, height: bitmap.height };
  } catch {
    // 回退:不支持 resize 选项 → 普通 decode 后由调用方 drawImage 缩放
    return decodeImage(blob);
  }
}

// ADR-015:Canvas 创建/上下文原语迁至 adapter,此处 re-export 保持
// operations/* 与外部消费方的导入路径不变。
export { createCanvas, get2DContext };
export type { Canvas2DContext } from '@lokvis/browser-adapter';
