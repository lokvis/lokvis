/**
 * 下载工具函数(@lokvis/embed-image 内部副本)。
 *
 * 与 apps/playground/src/components/toolkit/download.ts 保持一致;
 * 包内独立维护避免与 playground 相互耦合。
 *
 * - downloadBlob:触发浏览器下载单个 Blob
 * - formatBytes:格式化字节数为人类可读(KB/MB)
 * - getImageInfo:从 Blob 读取 dimensions + format + size
 */
/**
 * 从文件扩展名推断 MIME 类型(兜底)。
 * OPFS 存储后端读取 blob 时 type 可能为空,导致 Object URL 无 Content-Type,
 * 浏览器下载时退化成 application/octet-stream。这里从文件名推断 MIME 补全。
 */
function inferMimeFromFilename(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  const MIME_BY_EXT: Record<string, string> = {
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    webp: 'image/webp',
    avif: 'image/avif',
    gif: 'image/gif',
    bmp: 'image/bmp',
    svg: 'image/svg+xml',
    ico: 'image/x-icon',
  };
  return (ext && MIME_BY_EXT[ext]) || '';
}

export function downloadBlob(blob: Blob, filename: string): void {
  // 兜底:blob.type 为空或为 'application/octet-stream'(OPFS .bin 读取的默认
  // 兜底 MIME)时,从文件名推断真实 MIME type,避免下载为 .octet-stream
  const OPFS_FALLBACK_MIME = 'application/octet-stream';
  const needsTypeRepair = !blob.type || blob.type === OPFS_FALLBACK_MIME;
  const finalBlob = needsTypeRepair
    ? (() => {
        const mime = inferMimeFromFilename(filename);
        return mime ? new Blob([blob], { type: mime }) : blob;
      })()
    : blob;

  const url = URL.createObjectURL(finalBlob);
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
 * - image/svg+xml → SVG(去掉 +xml 后缀)
 * - image/webp → WEBP
 * - 未知 → UNKNOWN
 */
function formatFromMime(mime: string): string {
  const sub = mime.split('/')[1] ?? 'unknown';
  const main = sub.split('+')[0] ?? sub;
  return main.toUpperCase();
}

/**
 * 从 Blob 读取图片信息(width/height/format)。
 * 失败时返回 null(调用方应处理)。
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
    URL.revokeObjectURL(url);
  }
}

export function imageInfoToMeta(info: ImageInfo | null): string {
  if (!info) return '';
  return `${info.width}×${info.height} · ${formatBytes(info.size)} · ${info.format}`;
}

/**
 * 透明度检测:扫描图像 alpha 通道,判断是否存在半透明像素。
 */
export async function detectTransparency(blob: Blob): Promise<boolean> {
  const mime = blob.type.toLowerCase();
  if (mime === 'image/jpeg' || mime === 'image/bmp' || mime === 'image/jpg') return false;

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(blob);
  } catch (err) {
    console.warn('[detectTransparency] decode failed:', describeError(err));
    return false;
  }

  try {
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) {
      bitmap.close?.();
      console.warn('[detectTransparency] canvas 2d context unavailable');
      return false;
    }
    ctx.drawImage(bitmap, 0, 0);
    bitmap.close?.();
    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    for (let i = 3; i < data.length; i += 4) {
      if (data[i]! < 255) return true;
    }
    return false;
  } catch (err) {
    bitmap.close?.();
    console.warn('[detectTransparency] canvas/readback failed:', describeError(err));
    return false;
  }
}

function describeError(err: unknown): string {
  if (err instanceof DOMException) return `DOMException:${err.name}`;
  if (err instanceof Error) return `${err.name}: ${err.message}`;
  return String(err);
}
