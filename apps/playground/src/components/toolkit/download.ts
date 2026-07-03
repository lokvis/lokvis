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
 * 从 Blob 读取图片信息(width/height/format)。
 * format 从 MIME 类型提取(如 image/jpeg → JPEG)。
 * 失败时返回 null(调用方应处理)。
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
      format: (blob.type.split('/')[1] ?? 'unknown').toUpperCase(),
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
