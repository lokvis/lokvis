/**
 * 图像操作共享工具
 *
 * 被多个操作文件引用:
 * - inferFormat: 从 Blob 推断原始格式
 * - computeTargetSize: 按 fit 策略计算目标尺寸
 */
import type { ImageOutputFormat, ResizeParams } from '../types.js';

/** 从 Blob 推断原始格式，回退到默认格式 */
export function inferFormat(
  blob: Blob,
  fallback: ImageOutputFormat
): ImageOutputFormat {
  const mime = blob.type.toLowerCase();
  if (mime === 'image/png') return 'png';
  if (mime === 'image/jpeg') return 'jpeg';
  if (mime === 'image/webp') return 'webp';
  if (mime === 'image/avif') return 'avif';
  if (mime === 'image/gif') return 'gif';
  return fallback;
}

/** 计算目标尺寸（考虑 fit 策略与宽高比） */
export function computeTargetSize(
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
