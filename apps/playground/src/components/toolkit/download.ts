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
  try {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.src = url;
    await img.decode();
    const info: ImageInfo = {
      width: img.naturalWidth,
      height: img.naturalHeight,
      size: blob.size,
      format: formatFromMime(blob.type),
    };
    URL.revokeObjectURL(url);
    return info;
  } catch {
    return null;
  }
}

export function imageInfoToMeta(info: ImageInfo | null): string {
  if (!info) return '';
  return `${info.width}×${info.height} · ${formatBytes(info.size)} · ${info.format}`;
}
