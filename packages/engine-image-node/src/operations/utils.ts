/**
 * 图像操作共享工具(Node 引擎)
 *
 * 与 engine-image operations/utils.ts 对齐的纯工具函数:
 * - throwIfAborted: signal 检查
 * - inferFormat: Blob MIME → ImageOutputFormat
 * - computeTargetSize: 按 fit 策略计算目标尺寸
 *
 * 不依赖 sharp,纯逻辑可在任何环境运行。
 */
import type { ImageOutputFormat, ResizeParams } from '../types.js';

/**
 * 若 signal 已取消则抛出 AbortError(与 engine-image 行为一致)。
 *
 * 操作在 sharp pipeline 之间调用此助手,使 cancel() 能在长耗时编码阶段
 * 之间及时生效。sharp 自身不支持 AbortSignal,此检查只能在操作边界。
 */
export function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new DOMException('Operation aborted', 'AbortError');
  }
}

/** 从 Blob 推断原始格式,回退到默认格式 */
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

/**
 * 计算目标尺寸(考虑 fit 策略与宽高比)。
 *
 * 与 engine-image computeTargetSize 完全一致,使 resize 在浏览器与 Node
 * 产出尺寸相同(便于 diff 验证)。
 */
export function computeTargetSize(
  srcW: number,
  srcH: number,
  params: Record<string, any>
): { width: number; height: number } {
  const {
    width: targetW,
    height: targetH,
    fit: rawFit,
    maintainAspectRatio,
  } = params as ResizeParams;
  const fit = rawFit ?? 'cover';
  const maintain = maintainAspectRatio ?? true;

  if (!targetW && !targetH) {
    return { width: srcW, height: srcH };
  }

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

/** 把 ImageOutputFormat 转 sharp format 名(目前 1:1,留作未来扩展) */
export function toSharpFormat(format: ImageOutputFormat): string {
  return format;
}

/** 把 quality(1-100)归一化到 sharp 期望的范围 */
export function normalizeQuality(quality?: number, fallback = 85): number {
  if (typeof quality !== 'number' || !Number.isFinite(quality)) return fallback;
  return Math.min(100, Math.max(1, Math.round(quality)));
}

/**
 * 校验图片水印 URL 是否安全(防 SSRF)。
 *
 * 与 engine-image watermark.ts isSafeImageUrl 一致,额外允许 data: URL
 * (嵌入式 base64 数据,不发起网络请求,无 SSRF 风险)。
 *
 * 拒绝:
 * - 非 http/https/data 协议(file:// / ftp:// 等)
 * - localhost / 127.0.0.1 / 0.0.0.0
 * - 私有网段(10. / 192.168. / 172.16-31.)
 * - 链路本地(169.254.)
 * - IPv6 私有 / 链路本地
 * - 云元数据 host(metadata.google.internal 等)
 */
export function isSafeImageUrl(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  // data: URL 不发起网络请求,直接接受(限定 image/* MIME)
  if (parsed.protocol === 'data:') {
    return /^data:image\//i.test(url);
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
  const host = parsed.hostname.toLowerCase();
  if (host === 'localhost' || host === '::1' || host === '[::1]') return false;
  if (/^(0\.|127\.|10\.|192\.168\.|169\.254\.)/.test(host)) return false;
  if (/^172\.(1[6-9]|2[0-9]|3[01])\./.test(host)) return false;
  if (/^(fc|fd|fe8|fe9|fea|feb)/.test(host)) return false;
  if (/\.(local|internal|localhost)$/i.test(host)) return false;
  if (host === 'metadata.google.internal' || host === 'metadata.aws.internal')
    return false;
  return true;
}
