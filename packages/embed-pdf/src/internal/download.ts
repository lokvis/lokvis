/**
 * PDF 文件信息与下载工具(@lokvis/embed-pdf 内部)。
 */
import { getPdfInfo } from '@lokvis/engine-pdf';

/** PDF 文件元信息 */
export interface PdfFileInfo {
  /** 文件大小(bytes) */
  size: number;
  /** 页数(解析失败时为 null) */
  pageCount: number | null;
  /** MIME 类型 */
  format: string;
}

/**
 * 获取 PDF 文件基本信息。
 * 页数通过 engine-pdf 的 getPdfInfo(pdf-lib)解析;解析失败时 pageCount=null。
 */
export async function getPdfFileInfo(blob: Blob): Promise<PdfFileInfo> {
  let pageCount: number | null = null;
  try {
    const info = await getPdfInfo(blob);
    pageCount = info.pages;
  } catch {
    // 解析失败(加密/损坏)不阻塞,pageCount 留 null
  }
  return {
    size: blob.size,
    pageCount,
    format: blob.type || 'application/pdf',
  };
}

/** 触发浏览器下载 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** 格式化文件大小 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** i;
  return `${value < 10 ? value.toFixed(1) : Math.round(value)} ${units[i]}`;
}
