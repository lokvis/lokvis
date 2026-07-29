/**
 * 统一编码分发：native-first / wasm-fallback
 * （设计文档 docs/reports/20260724-engine-wasm-avif-encoder.md §四.1）
 *
 * 所有操作（compress / convert / setBackground / transform 系列 / filter /
 * watermark / tile / targetSize 二分）的编码调用点统一经由此函数：
 *
 * 1. 原生编码器可用（png/jpeg 恒真，webp/avif 运行时探测）→ canvas 原生路径
 * 2. 原生不可用且 format === 'avif' 且 wasm 兜底启用 → libavif WASM 编码
 *    （编码器私有 worker，off-main-thread）
 * 3. 无兜底 → 保持既有 throw 语义（encodeImage 对静默回退 PNG 抛错）
 *
 * 原生支持探测结果模块级缓存（浏览器内运行时不变，探测一次）。
 */
import type { ImageOutputFormat } from '../types.js';
import { encodeImage, detectFormatSupport, get2DContext } from '../canvas-engine.js';
import { wasmEncodersEnabled } from '../wasm-config.js';
import { encodeAvifWasm } from '../wasm/avif-encoder.js';

let nativeSupportCache: Record<ImageOutputFormat, boolean> | null = null;

async function isNativeEncodeSupported(
  format: ImageOutputFormat
): Promise<boolean> {
  // png/jpeg 所有浏览器均支持，短路避免无谓探测
  if (format === 'png' || format === 'jpeg') {
    return true;
  }
  nativeSupportCache ??= await detectFormatSupport();
  return nativeSupportCache[format] ?? false;
}

/** 清空原生支持探测缓存（仅测试使用） */
export function clearNativeSupportCache(): void {
  nativeSupportCache = null;
}

/**
 * 智能编码分发。
 *
 * @param canvas 已绘制完成的画布（OffscreenCanvas 或 DOM Canvas）
 * @param format 目标格式
 * @param quality 质量 0-100
 * @param signal 可选取消信号（仅 wasm 路径消费——canvas 原生编码不可中断）
 */
export async function encodeSmart(
  canvas: HTMLCanvasElement | OffscreenCanvas,
  format: ImageOutputFormat,
  quality: number,
  signal?: AbortSignal
): Promise<Blob> {
  if (await isNativeEncodeSupported(format)) {
    return encodeImage(canvas, format, quality);
  }
  if (format === 'avif' && wasmEncodersEnabled() && typeof Worker !== 'undefined') {
    const ctx = get2DContext(canvas);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    return encodeAvifWasm(imageData, quality, signal);
  }
  // 无兜底：保持既有 throw 语义（上层用 detectFormatSupport 门控）
  return encodeImage(canvas, format, quality);
}
