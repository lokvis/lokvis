/**
 * 下载工具函数。
 *
 * - downloadBlob:触发浏览器下载单个 Blob
 * - formatBytes:格式化字节数为人类可读(KB/MB)
 * - getImageInfo:从 Blob 读取 dimensions + format + size(用于 PreviewBox meta)
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
 *
 * 异常处理:解码(createImageBitmap)与 canvas 读回(getImageData)分两阶段,
 * 各自捕获并记录具体异常类型(DOMException name / Error name),便于排查
 * "格式不支持 / 图片损坏"(decode)与"tainted canvas / 0×0 / GPU 失败"(canvas)
 * 两类不同根因,而非一律静默吞掉。任一阶段失败都保守返回 false(按 WebP 处理)。
 */
export async function detectTransparency(blob: Blob): Promise<boolean> {
  const mime = blob.type.toLowerCase();
  // JPEG / BMP 不支持透明 → 短路返回,免去解码开销
  if (mime === 'image/jpeg' || mime === 'image/bmp' || mime === 'image/jpg') return false;

  // 阶段 1:解码。损坏图片 / 不支持的格式会抛 DataError / InvalidStateError / NotSupportedError
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(blob);
  } catch (err) {
    console.warn('[detectTransparency] decode failed:', describeError(err));
    return false;
  }

  // 阶段 2:canvas 渲染 + 像素读回。SecurityError(tainted canvas)/ IndexSizeError(0×0)/
  // InvalidStateError(GPU 上下文丢失)可能在此阶段抛出
  try {
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) {
      // canvas 2D context 不可用(罕见:浏览器禁用加速 / 内存耗尽)
      bitmap.close?.();
      console.warn('[detectTransparency] canvas 2d context unavailable');
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
  } catch (err) {
    bitmap.close?.();
    console.warn('[detectTransparency] canvas/readback failed:', describeError(err));
    return false;
  }
}

/** 把异常归一为可读字符串,便于在日志里区分类型(DOMException 按 name,其余按 name+message) */
function describeError(err: unknown): string {
  if (err instanceof DOMException) return `DOMException:${err.name}`;
  if (err instanceof Error) return `${err.name}: ${err.message}`;
  return String(err);
}
