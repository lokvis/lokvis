/**
 * 浏览器下载工具(@lokvis/embed-* 共享)。
 *
 * 此前 embed-image / embed-pdf / embed-video 各自维护 downloadBlob 副本
 * (embed-image 版含 MIME 兜底修复,pdf/video 版为简化实现),易 drift。
 * 统一收敛到 embed-kit,各包从此再导出。
 *
 * DOM 保存动作(a[download] / showSaveFilePicker)统一走
 * `@lokvis/browser-adapter` 的 FilePickerAdapter(ADR-015 / ADR-018),
 * 不再在本文件散写 `document.createElement('a')`:
 * - `downloadBlob`:同步、即时下载(a[download] 降级路径,不弹"另存为"),
 *   保持既有 embed-* / playground 调用点与 e2e 行为不变。
 * - `saveBlob`:异步、优先原生"另存为"对话框(Chrome/Edge),降级 a[download]。
 */
import { createFilePickerAdapter } from '@lokvis/browser-adapter';

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

/** blob.type 为空或 OPFS 兜底 MIME 时,据文件名补全 type */
function repairBlobType(blob: Blob, filename: string): Blob {
  const OPFS_FALLBACK_MIME = 'application/octet-stream';
  const needsTypeRepair = !blob.type || blob.type === OPFS_FALLBACK_MIME;
  if (!needsTypeRepair) return blob;
  const mime = inferMimeFromFilename(filename);
  return mime ? new Blob([blob], { type: mime }) : blob;
}

/**
 * 触发浏览器下载单个 Blob(同步、即时,不弹"另存为")。
 *
 * blob.type 为空或为 'application/octet-stream'(OPFS .bin 读取的默认兜底
 * MIME)时,从文件名推断真实 MIME type,避免下载为 .octet-stream。
 *
 * 委托 FilePickerAdapter.downloadFile:始终走 a[download] 即时下载,
 * 不触发原生"另存为"对话框,保持既有调用点/e2e 行为不变。
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const finalBlob = repairBlobType(blob, filename);
  const picker = createFilePickerAdapter();
  picker.downloadFile(finalBlob, filename);
}

/**
 * 保存 Blob,优先原生"另存为"对话框(Chrome/Edge showSaveFilePicker),
 * 不支持时降级即时下载(a[download])。
 *
 * 与 downloadBlob 的区别:异步 + 让用户选择保存位置。返回 true 表示已保存/
 * 已触发下载,false 表示用户取消(仅原生可判定)。
 */
export async function saveBlob(blob: Blob, filename: string): Promise<boolean> {
  const finalBlob = repairBlobType(blob, filename);
  const picker = createFilePickerAdapter();
  return picker.saveFile(finalBlob, filename);
}
