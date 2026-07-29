/**
 * PDF 文件信息工具(@lokvis/embed-pdf 内部)。
 *
 * 仅承载 PDF 专属元信息(PdfFileInfo / getPdfFileInfo)。通用下载 /
 * 字节格式化分别属 @lokvis/embed-kit(downloadBlob)与 @lokvis/runtime
 * (formatBytes),消费方直接从对应包导入,不在此中转。
 */

/** PDF 文件元信息 */
export interface PdfFileInfo {
  /** 文件大小(bytes) */
  size: number;
  /** 页数(未知时为 null) */
  pageCount: number | null;
  /** MIME 类型 */
  format: string;
}

/**
 * 由 Blob 与已知页数构造 PdfFileInfo(纯函数)。
 *
 * 页数不在此解析:embed-pdf 属顶层消费者,遵循五层单向依赖,不直接 import
 * engine-pdf。调用方(usePdfTool)持有 runtime 与 assetId,经
 * `runtime.readAssetPdfInfo(id)`(MetadataReader 依赖反转)读取页数后传入。
 * 无 runtime 场景可传 null。
 */
export function getPdfFileInfo(blob: Blob, pageCount: number | null = null): PdfFileInfo {
  return {
    size: blob.size,
    pageCount,
    format: blob.type || 'application/pdf',
  };
}
