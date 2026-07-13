/**
 * 水印操作:文字水印 / 图片水印
 *
 * 含位置计算(computeWatermarkPosition),
 * 支持 9 宫格位置 + tile 模式。
 */
import type { WatermarkParams, WatermarkPosition } from '../types.js';
import { canvasEngine, createCanvas, get2DContext } from '../canvas-engine.js';
import { inferFormat, throwIfAborted } from './utils.js';

/**
 * 校验图片水印 URL 是否安全（防 SSRF）。
 *
 * 修复 review 报告：原实现直接 `await fetch(params.image)`，攻击者可传任意 URL
 * 让服务端发起请求，可能扫描内网（127.0.0.1 / 169.254.169.254 云元数据 / 私有网段）。
 *
 * 校验规则：
 *   - 协议仅 http/https
 *   - 拒绝 loopback / 链路本地 / 私有网段 / 元数据 host
 *
 * 注：浏览器场景 fetch 受 CSP 限制，但 Node 端或 Worker 端无此保护，仍需在代码侧守门。
 * 不防御 DNS rebinding（需要解析后再次校验 IP），Worker 场景无 DNS 解析能力。
 */
function isSafeImageUrl(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
  const host = parsed.hostname.toLowerCase();
  if (host === 'localhost' || host === '::1' || host === '[::1]') return false;
  // IPv4 私有/环回/链路本地/0.0.0.0
  if (/^(0\.|127\.|10\.|192\.168\.|169\.254\.)/.test(host)) return false;
  if (/^172\.(1[6-9]|2[0-9]|3[01])\./.test(host)) return false;
  // IPv6 私有 (fc00::/7) 与链路本地 (fe80::)
  if (/^(fc|fd|fe8|fe9|fea|feb)/.test(host)) return false;
  // 内部后缀
  if (/\.(local|internal|localhost)$/i.test(host)) return false;
  // 云元数据 host
  if (host === 'metadata.google.internal' || host === 'metadata.aws.internal') return false;
  return true;
}

/** Watermark：水印 */
export async function watermark(
  blob: Blob,
  params: Record<string, any>,
  signal?: AbortSignal
): Promise<Blob> {
  const {
    text,
    image: imageUrl,
    position,
    opacity,
    fontSize,
    color,
  } = params as WatermarkParams;

  const { bitmap, width, height } = await canvasEngine.decode(blob);
  throwIfAborted(signal);
  const canvas = createCanvas(width, height);
  const ctx = get2DContext(canvas);
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close?.();

  const wmOpacity = opacity ?? 0.8;
  ctx.globalAlpha = wmOpacity;

  if (imageUrl) {
    if (!isSafeImageUrl(imageUrl)) {
      throw new Error(
        `Watermark image URL not allowed (SSRF guard): ${imageUrl}`
      );
    }
    // fetch 本身可接受 AbortSignal,使网络阶段也能被 cancel 中断
    const resp = await fetch(imageUrl, signal ? { signal } : undefined);
    if (!resp.ok) {
      throw new Error(
        `Failed to fetch watermark image from ${imageUrl}: ${resp.status} ${resp.statusText}`
      );
    }
    const wmBlob = await resp.blob();
    const wmBitmap = await createImageBitmap(wmBlob);
    const wmW = wmBitmap.width;
    const wmH = wmBitmap.height;

    if (position === 'tile') {
      const spacing = Math.max(wmW, wmH);
      for (let y = 0; y < height + wmH; y += wmH + spacing) {
        throwIfAborted(signal);
        for (let x = 0; x < width + wmW; x += wmW + spacing) {
          ctx.drawImage(wmBitmap, x, y, wmW, wmH);
        }
      }
    } else {
      const pos = computeWatermarkPosition(
        position ?? 'bottom-right',
        width,
        height,
        wmW,
        wmH
      );
      ctx.drawImage(wmBitmap, pos.x, pos.y, wmW, wmH);
    }
    wmBitmap.close?.();
  } else if (text) {
    const size = fontSize ?? 24;
    ctx.font = `${size}px sans-serif`;
    ctx.fillStyle = color ?? '#ffffff';
    ctx.textBaseline = 'top';
    const metrics = ctx.measureText(text);
    const textW = metrics.width;

    if (position === 'tile') {
      const spacing = Math.max(textW, size) * 1.5;
      for (let y = 0; y < height + size; y += size + spacing) {
        throwIfAborted(signal);
        for (let x = 0; x < width + textW; x += textW + spacing) {
          ctx.fillText(text, x, y);
        }
      }
    } else {
      const pos = computeWatermarkPosition(
        position ?? 'bottom-right',
        width,
        height,
        textW,
        size
      );
      ctx.fillText(text, pos.x, pos.y);
    }
  }
  ctx.globalAlpha = 1;
  throwIfAborted(signal);

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
    default:
      return { x: margin, y: margin };
  }
}
