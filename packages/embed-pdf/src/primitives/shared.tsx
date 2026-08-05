/**
 * Layer 1 共享工具(@lokvis/embed-pdf 内部)。
 */

/** 检查文件是否为 PDF */
export function fileMatchesPdf(file: File): boolean {
  return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
}

// FO-40: DefaultPresetButton 已收敛到 @lokvis/embed-kit,此处 re-export 保持向后兼容
export { DefaultPresetButton } from '@lokvis/embed-kit';
