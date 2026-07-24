/**
 * Layer 1 primitives 入口(barrel)。
 *
 * 无样式组件,提供行为 + ARIA,零视觉决策。
 * 三方接入路径:
 *   import { PdfCompress } from '@lokvis/embed-pdf/primitives';
 */

export { PdfCompress } from './PdfCompress';
export { PdfMerge } from './PdfMerge';
export { PdfSplit } from './PdfSplit';
export { PdfRotate } from './PdfRotate';
export { PdfWatermark } from './PdfWatermark';
export { fileMatchesPdf, DefaultPresetButton } from './shared';
