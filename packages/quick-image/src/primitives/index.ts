/**
 * Layer 1 primitives 入口(barrel)。
 *
 * 三方接入路径:
 *   import { QuickCompress } from '@lokvis/quick-image/primitives';
 *
 * 包含 6 个原语集合(覆盖 6 个工具),每个集合 8 个原语。
 */

// ─── Quick Compress ──────────────────────────────────────
export { QuickCompress } from './QuickCompress';
export type {
  QuickCompressRootProps,
  QuickCompressUploadProps,
  QuickCompressPresetSwitcherProps,
  QuickCompressPreviewProps,
  QuickCompressRatioBadgeProps,
  QuickCompressDownloadButtonProps,
  QuickCompressErrorDisplayProps,
  QuickCompressResetButtonProps,
} from './QuickCompress';

// ─── Quick Resize ────────────────────────────────────────
export { QuickResize } from './QuickResize';
export type {
  QuickResizeRootProps,
  QuickResizeUploadProps,
  QuickResizePresetSwitcherProps,
  QuickResizePreviewProps,
  QuickResizeDimensionBadgeProps,
  QuickResizeDownloadButtonProps,
  QuickResizeErrorDisplayProps,
  QuickResizeResetButtonProps,
} from './QuickResize';

// ─── Quick Convert ───────────────────────────────────────
export { QuickConvert } from './QuickConvert';
export type {
  QuickConvertRootProps,
  QuickConvertUploadProps,
  QuickConvertPresetSwitcherProps,
  QuickConvertPreviewProps,
  QuickConvertFormatBadgeProps,
  QuickConvertDownloadButtonProps,
  QuickConvertErrorDisplayProps,
  QuickConvertResetButtonProps,
} from './QuickConvert';

// ─── Quick Watermark ─────────────────────────────────────
export { QuickWatermark } from './QuickWatermark';
export type {
  QuickWatermarkRootProps,
  QuickWatermarkUploadProps,
  QuickWatermarkPresetSwitcherProps,
  QuickWatermarkPreviewProps,
  QuickWatermarkTextInputProps,
  QuickWatermarkDownloadButtonProps,
  QuickWatermarkErrorDisplayProps,
  QuickWatermarkResetButtonProps,
} from './QuickWatermark';

// ─── Quick Crop ───────────────────────────────────────────
export { QuickCrop } from './QuickCrop';
export type {
  QuickCropRootProps,
  QuickCropUploadProps,
  QuickCropPresetSwitcherProps,
  QuickCropPreviewProps,
  QuickCropAreaProps,
  QuickCropDownloadButtonProps,
  QuickCropErrorDisplayProps,
  QuickCropResetButtonProps,
} from './QuickCrop';

// ─── Quick Pipeline ──────────────────────────────────────
export { QuickPipeline } from './QuickPipeline';
export type {
  QuickPipelineRootProps,
  QuickPipelineUploadProps,
  QuickPipelinePresetSwitcherProps,
  QuickPipelinePreviewProps,
  QuickPipelineStepListProps,
  QuickPipelineDownloadButtonProps,
  QuickPipelineErrorDisplayProps,
  QuickPipelineResetButtonProps,
} from './QuickPipeline';

// 共享工具(原语内部使用;导出便于三方自定义原语复用)
export {
  fileMatchesAccept,
  guessExtension,
  DefaultPresetButton,
  type DefaultPresetButtonProps,
} from './shared';
