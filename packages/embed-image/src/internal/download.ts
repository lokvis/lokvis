/**
 * 图片文件信息工具(@lokvis/embed-image 内部)。
 *
 * 仅承载图片专属分析(getImageInfo / imageInfoToMeta / detectTransparency 等)。
 * 通用下载 / 字节格式化分别属 @lokvis/embed-kit(downloadBlob)与
 * @lokvis/runtime(formatBytes),消费方直接从对应包导入,不在此中转。
 */
import { formatBytes } from '@lokvis/runtime';

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
