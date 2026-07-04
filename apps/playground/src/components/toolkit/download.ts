/**
 * 下载工具函数。
 *
 * - downloadBlob:触发浏览器下载单个 Blob
 * - formatBytes:格式化字节数为人类可读(KB/MB)
 * - getImageInfo:从 Blob 读取 dimensions + format + size(用于 PreviewBox meta)
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // 给浏览器一点时间发起下载再 revoke
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export interface ImageInfo {
  width: number;
  height: number;
  size: number;
  format: string;
}

/**
 * 从 MIME 类型提取格式名。
 * - image/jpeg → JPEG
 * - image/svg+xml → SVG(去掉 +xml 后缀,#11 修复)
 * - image/webp → WEBP
 * - 未知 → UNKNOWN
 */
function formatFromMime(mime: string): string {
  const sub = mime.split('/')[1] ?? 'unknown';
  // image/svg+xml → svg+xml → svg(去掉 +xml)
  // image/x-icon → x-icon → 保留(常见图标格式)
  const main = sub.split('+')[0] ?? sub;
  return main.toUpperCase();
}

/**
 * 从 Blob 读取图片信息(width/height/format)。
 * format 从 MIME 类型提取(如 image/jpeg → JPEG)。
 * 失败时返回 null(调用方应处理)。
 *
 * SVG 处理(#6 修复):img.decode() 对 SVG 会成功但 naturalWidth/Height 可能为 0
 * (无明确 width/height 属性的 SVG)。此时用 0 占位,调用方应处理 width=0 的情况。
 */
export async function getImageInfo(blob: Blob): Promise<ImageInfo | null> {
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return {
      width: img.naturalWidth,
      height: img.naturalHeight,
      size: blob.size,
      format: formatFromMime(blob.type),
    };
  } catch {
    return null;
  } finally {
    // 无论 decode 成功还是失败(损坏图片/不支持格式)都要 revoke,
    // 否则每个失败的图片都会泄漏一个 Blob URL。
    URL.revokeObjectURL(url);
  }
}

export function imageInfoToMeta(info: ImageInfo | null): string {
  if (!info) return '';
  return `${info.width}×${info.height} · ${formatBytes(info.size)} · ${info.format}`;
}

/**
 * 透明度检测:扫描图像 alpha 通道,判断是否存在半透明像素(W8.6 智能格式用)。
 *
 * 用于"智能格式"默认值推断:含透明像素 → 输出 PNG(保留透明);否则 → WebP(更高压缩率)。
 * 仅作 UI 层提示,不影响 engine-image 的 Blob→Blob 契约。
 *
 * 性能:对 4000×3000 图像约 12M 像素扫描,实测 < 80ms;若担心大图卡顿,
 * 后续可下放到 Web Worker。当前在 import 后异步触发,不阻塞 UI。
 *
 * JPEG/BMP 不支持透明通道,直接返回 false 以跳过解码。
 */
export async function detectTransparency(blob: Blob): Promise<boolean> {
  const mime = blob.type.toLowerCase();
  // JPEG / BMP 不支持透明 → 短路返回,免去解码开销
  if (mime === 'image/jpeg' || mime === 'image/bmp' || mime === 'image/jpg') return false;

  try {
    const bitmap = await createImageBitmap(blob);
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) {
      bitmap.close?.();
      return false;
    }
    ctx.drawImage(bitmap, 0, 0);
    bitmap.close?.();
    // 扫描 alpha 通道:步长 4(每像素 RGBA)。任意像素 alpha < 255 即视为含透明。
    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    for (let i = 3; i < data.length; i += 4) {
      if (data[i]! < 255) return true;
    }
    return false;
  } catch {
    // 解码失败或 canvas 不可用:保守返回 false(后续按 WebP 处理)
    return false;
  }
}
