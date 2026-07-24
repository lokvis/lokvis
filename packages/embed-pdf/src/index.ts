/**
 * @lokvis/embed-pdf
 *
 * 三层 PDF 工具组件,供三方快速接入:
 *
 * 接入路径(按自由度递增):
 *   1. 零配置:<PdfEmbedCompress />
 *   2. 主题:<PdfEmbedCompress theme={{...}} />
 *   3. CSS 变量:覆盖 .lokvis-embed-pdf { --lokvis-pdf-* }
 *   4. 组件替换:<PdfEmbedCompress components={{...}} />
 *   5. 原语组装:<PdfCompress.Root>...</PdfCompress.Root>
 *   6. 纯 hooks:usePdfCompress() 完全自建 UI
 *
 * 子路径导出:
 *   - '@lokvis/embed-pdf'           全量(Layer 0+1+2 + theme + i18n)
 *   - '@lokvis/embed-pdf/hooks'     仅 Layer 0(无头 hooks)
 *   - '@lokvis/embed-pdf/primitives' 仅 Layer 1(无样式原语)
 *   - '@lokvis/embed-pdf/styles.css' CSS 变量主题
 */

// ─── Layer 0: Hooks ──────────────────────────────────────
export {
  usePdfCompress,
  usePdfMerge,
  usePdfSplit,
  usePdfRotate,
  usePdfWatermark,
  PDF_COMPRESS_PRESETS,
  PDF_SPLIT_PRESETS,
  PDF_ROTATE_PRESETS,
  PDF_WATERMARK_PRESETS,
  DEFAULT_WATERMARK_TEXT,
  type PdfCompressPreset,
  type PdfSplitPreset,
  type PdfRotatePreset,
  type PdfWatermarkPreset,
  type UsePdfActionOptions,
  type PdfActionResult,
  type UsePdfCompressResult,
  type UsePdfMergeOptions,
  type UsePdfMergeResult,
  type UsePdfSplitOptions,
  type UsePdfSplitResult,
  type UsePdfRotateOptions,
  type UsePdfRotateResult,
  type UsePdfWatermarkOptions,
  type UsePdfWatermarkResult,
} from './hooks/index';

// ─── Layer 1: Primitives ─────────────────────────────────
export {
  PdfCompress,
  PdfMerge,
  PdfSplit,
  PdfRotate,
  PdfWatermark,
  fileMatchesPdf,
  DefaultPresetButton,
} from './primitives/index';

// ─── Internal utilities (public for advanced consumers) ──
export { getPdfFileInfo, downloadBlob, formatBytes, type PdfFileInfo } from './internal/download';
