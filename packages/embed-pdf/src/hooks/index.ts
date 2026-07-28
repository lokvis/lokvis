/**
 * Layer 0 hooks 入口(barrel)。
 *
 * 三方接入路径:
 *   import { usePdfCompress } from '@lokvis/embed-pdf/hooks';
 *
 * 包含 6 个 hook(覆盖 6 个工具):
 *   - usePdfCompress:一键压缩
 *   - usePdfMerge:多文件合并
 *   - usePdfSplit:按页拆分
 *   - usePdfRotate:旋转页面
 *   - usePdfWatermark:加水印
 *   - usePdfPageNumbers:添加页码
 */

// ─── PDF Compress ──────────────────────────────────────
export {
  usePdfCompress,
  PDF_COMPRESS_PRESETS,
  type PdfCompressPreset,
  type UsePdfCompressResult,
  type UsePdfActionOptions,
  type PdfActionResult,
} from './usePdfCompress';

// ─── PDF Merge ─────────────────────────────────────────
export {
  usePdfMerge,
  type UsePdfMergeOptions,
  type UsePdfMergeResult,
} from './usePdfMerge';

// ─── PDF Split ─────────────────────────────────────────
export {
  usePdfSplit,
  PDF_SPLIT_PRESETS,
  type PdfSplitPreset,
  type UsePdfSplitOptions,
  type UsePdfSplitResult,
} from './usePdfSplit';

// ─── PDF Rotate ────────────────────────────────────────
export {
  usePdfRotate,
  PDF_ROTATE_PRESETS,
  type PdfRotatePreset,
  type UsePdfRotateOptions,
  type UsePdfRotateResult,
} from './usePdfRotate';

// ─── PDF Watermark ─────────────────────────────────────
export {
  usePdfWatermark,
  PDF_WATERMARK_PRESETS,
  DEFAULT_WATERMARK_TEXT,
  type PdfWatermarkPreset,
  type UsePdfWatermarkOptions,
  type UsePdfWatermarkResult,
} from './usePdfWatermark';

// ─── PDF Page Numbers ──────────────────────────────────
export {
  usePdfPageNumbers,
  PDF_PAGE_NUMBER_POSITIONS,
  DEFAULT_PAGE_NUMBER_FORMAT,
  type PdfPageNumberPosition,
  type UsePdfPageNumbersOptions,
  type UsePdfPageNumbersResult,
} from './usePdfPageNumbers';
