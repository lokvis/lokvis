/**
 * 浏览器下载工具(@lokvis/embed-* 共享)。
 *
 * 此前 embed-image / embed-pdf / embed-video 各自维护 downloadBlob 副本
 * (embed-image 版含 MIME 兜底修复,pdf/video 版为简化实现),易 drift。
 * 统一收敛到 embed-kit,各包从此再导出。
 */

/**
 * 从文件扩展名推断 MIME 类型(兜底)。
 *
 * OPFS 存储后端读取 blob 时 type 可能为空或为通用 application/octet-stream,
 * 导致 Object URL 无正确 Content-Type,浏览器下载时退化成 .octet-stream。
 * 这里覆盖图像 / PDF / 常见音视频扩展名以补全。
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
    pdf: 'application/pdf',
    mp4: 'video/mp4',
    webm: 'video/webm',
    mov: 'video/quicktime',
    gifv: 'video/mp4',
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    ogg: 'audio/ogg',
    m4a: 'audio/mp4',
  };
  return (ext && MIME_BY_EXT[ext]) || '';
}

/**
 * 触发浏览器下载单个 Blob。
 *
 * blob.type 为空或为 'application/octet-stream'(OPFS .bin 读取的默认兜底
 * MIME)时,从文件名推断真实 MIME type,避免下载为 .octet-stream。
 */
export function downloadBlob(blob: Blob, filename: string): void {
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
