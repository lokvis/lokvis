/**
 * @lokvis/quick-image — Image Workspace Quick Actions 三层架构。
 *
 * 三层架构(见 docs/reports/20260719-image-workspace-ui-design.md):
 *   - Layer 0:Headless Hook(useQuickCompress,纯逻辑,无 UI)
 *   - Layer 1:Unstyled Primitives(QuickCompress,无样式,有行为)
 *   - Layer 2:Default UI(ImageQuickCompress,Tailwind 默认样式)
 *
 * 三方接入路径(按自由度递增):
 *   1. 零配置:      <ImageQuickCompress />
 *   2. 主题定制:    <ImageQuickCompress theme={{...}} />
 *   3. CSS 变量:    覆盖 .lokvis-quick-compress { --lokvis-* }
 *   4. 组件替换:    <ImageQuickCompress components={{...}} />
 *   5. 原语组装:    <QuickCompress.Root>...</QuickCompress.Root>
 *   6. 完全自定义:  useQuickCompress() hook
 *
 * 子路径导出:
 *   - '@lokvis/quick-image'             — 全量(Layer 0/1/2 + 主题)
 *   - '@lokvis/quick-image/hooks'       — 仅 Layer 0 hooks
 *   - '@lokvis/quick-image/primitives'  — 仅 Layer 1 primitives
 */

// ─── Quick Compress ───────────────────────────────────────

// Layer 0:Hook
export {
  useQuickCompress,
  COMPRESS_PRESETS,
  type CompressPreset,
  type UseQuickCompressResult,
  type UseQuickActionOptions,
  type QuickActionResult,
} from './hooks/useQuickCompress';

// Layer 1:Primitives
export { QuickCompress } from './primitives/QuickCompress';
export type {
  QuickCompressRootProps,
  QuickCompressUploadProps,
  QuickCompressPresetSwitcherProps,
  QuickCompressPreviewProps,
  QuickCompressRatioBadgeProps,
  QuickCompressDownloadButtonProps,
  QuickCompressErrorDisplayProps,
  QuickCompressResetButtonProps,
} from './primitives/QuickCompress';

// Layer 2:Default UI
export { default as ImageQuickCompress } from './ImageQuickCompress';
export type {
  ImageQuickCompressProps,
  QuickCompressComponents,
  UploadBoxProps as CompressUploadBoxProps,
  PreviewBoxProps as CompressPreviewBoxProps,
  PresetSwitcherProps as CompressPresetSwitcherProps,
  DownloadButtonProps as CompressDownloadButtonProps,
  RatioBadgeProps,
  ErrorDisplayProps as CompressErrorDisplayProps,
  ResetButtonProps as CompressResetButtonProps,
} from './ImageQuickCompress';

// ─── Quick Resize ─────────────────────────────────────────

// Layer 0:Hook
export {
  useQuickResize,
  RESIZE_PRESETS,
  type ResizePreset,
  type ResizePresetConfig,
  type UseQuickResizeResult,
} from './hooks/useQuickResize';

// Layer 1:Primitives
export { QuickResize } from './primitives/QuickResize';
export type {
  QuickResizeRootProps,
  QuickResizeUploadProps,
  QuickResizePresetSwitcherProps,
  QuickResizePreviewProps,
  QuickResizeDimensionBadgeProps,
  QuickResizeDownloadButtonProps,
  QuickResizeErrorDisplayProps,
  QuickResizeResetButtonProps,
} from './primitives/QuickResize';

// Layer 2:Default UI
export { default as ImageQuickResize } from './ImageQuickResize';
export type {
  ImageQuickResizeProps,
  QuickResizeComponents,
  UploadBoxProps as ResizeUploadBoxProps,
  PreviewBoxProps as ResizePreviewBoxProps,
  PresetSwitcherProps as ResizePresetSwitcherProps,
  DownloadButtonProps as ResizeDownloadButtonProps,
  DimensionBadgeProps,
  ErrorDisplayProps as ResizeErrorDisplayProps,
  ResetButtonProps as ResizeResetButtonProps,
} from './ImageQuickResize';

// ─── Quick Convert ────────────────────────────────────────

// Layer 0:Hook
export {
  useQuickConvert,
  CONVERT_PRESETS,
  type ConvertPreset,
  type ConvertPresetConfig,
  type UseQuickConvertResult,
} from './hooks/useQuickConvert';

// Layer 1:Primitives
export { QuickConvert } from './primitives/QuickConvert';
export type {
  QuickConvertRootProps,
  QuickConvertUploadProps,
  QuickConvertPresetSwitcherProps,
  QuickConvertPreviewProps,
  QuickConvertFormatBadgeProps,
  QuickConvertDownloadButtonProps,
  QuickConvertErrorDisplayProps,
  QuickConvertResetButtonProps,
} from './primitives/QuickConvert';

// Layer 2:Default UI
export { default as ImageQuickConvert } from './ImageQuickConvert';
export type {
  ImageQuickConvertProps,
  QuickConvertComponents,
  UploadBoxProps as ConvertUploadBoxProps,
  PreviewBoxProps as ConvertPreviewBoxProps,
  PresetSwitcherProps as ConvertPresetSwitcherProps,
  DownloadButtonProps as ConvertDownloadButtonProps,
  FormatBadgeProps,
  ErrorDisplayProps as ConvertErrorDisplayProps,
  ResetButtonProps as ConvertResetButtonProps,
} from './ImageQuickConvert';

// ─── Quick Watermark ─────────────────────────────────────

// Layer 0:Hook
export {
  useQuickWatermark,
  WATERMARK_PRESETS,
  DEFAULT_WATERMARK_TEXT,
  type WatermarkPreset,
  type WatermarkPresetConfig,
  type UseQuickWatermarkOptions,
  type UseQuickWatermarkResult,
} from './hooks/useQuickWatermark';

// Layer 1:Primitives
export { QuickWatermark } from './primitives/QuickWatermark';
export type {
  QuickWatermarkRootProps,
  QuickWatermarkUploadProps,
  QuickWatermarkPresetSwitcherProps,
  QuickWatermarkPreviewProps,
  QuickWatermarkTextInputProps,
  QuickWatermarkDownloadButtonProps,
  QuickWatermarkErrorDisplayProps,
  QuickWatermarkResetButtonProps,
} from './primitives/QuickWatermark';

// Layer 2:Default UI
export { default as ImageQuickWatermark } from './ImageQuickWatermark';
export type {
  ImageQuickWatermarkProps,
  QuickWatermarkComponents,
  UploadBoxProps as WatermarkUploadBoxProps,
  PreviewBoxProps as WatermarkPreviewBoxProps,
  PresetSwitcherProps as WatermarkPresetSwitcherProps,
  TextInputProps as WatermarkTextInputProps,
  DownloadButtonProps as WatermarkDownloadButtonProps,
  ErrorDisplayProps as WatermarkErrorDisplayProps,
  ResetButtonProps as WatermarkResetButtonProps,
} from './ImageQuickWatermark';

// ─── Quick Crop ───────────────────────────────────────────

// Layer 0:Hook
export {
  useQuickCrop,
  CROP_PRESETS,
  computeCropRect,
  type CropPreset,
  type CropPresetConfig,
  type CropRect,
  type UseQuickCropResult,
} from './hooks/useQuickCrop';

// Layer 1:Primitives
export { QuickCrop } from './primitives/QuickCrop';
export type {
  QuickCropRootProps,
  QuickCropUploadProps,
  QuickCropPresetSwitcherProps,
  QuickCropPreviewProps,
  QuickCropAreaProps,
  QuickCropDownloadButtonProps,
  QuickCropErrorDisplayProps,
  QuickCropResetButtonProps,
} from './primitives/QuickCrop';

// Layer 2:Default UI
export { default as ImageQuickCrop } from './ImageQuickCrop';
export type {
  ImageQuickCropProps,
  QuickCropComponents,
  UploadBoxProps as CropUploadBoxProps,
  PreviewBoxProps as CropPreviewBoxProps,
  PresetSwitcherProps as CropPresetSwitcherProps,
  CropAreaBoxProps,
  DownloadButtonProps as CropDownloadButtonProps,
  ErrorDisplayProps as CropErrorDisplayProps,
  ResetButtonProps as CropResetButtonProps,
} from './ImageQuickCrop';

// ─── Quick Pipeline ───────────────────────────────────────

// Layer 0:Hook
export {
  useImagePipeline,
  PIPELINE_PRESETS,
  buildPipelineWorkflow,
  type PipelinePreset,
  type PipelinePresetConfig,
  type PipelineStepConfig,
  type PipelineStepOutput,
  type PipelineResult,
  type UseImagePipelineOptions,
  type UseImagePipelineResult,
} from './hooks/useImagePipeline';

// Layer 1:Primitives
export { QuickPipeline } from './primitives/QuickPipeline';
export type {
  QuickPipelineRootProps,
  QuickPipelineUploadProps,
  QuickPipelinePresetSwitcherProps,
  QuickPipelinePreviewProps,
  QuickPipelineStepListProps,
  QuickPipelineDownloadButtonProps,
  QuickPipelineErrorDisplayProps,
  QuickPipelineResetButtonProps,
} from './primitives/QuickPipeline';

// Layer 2:Default UI
export { default as ImageQuickPipeline } from './ImageQuickPipeline';
export type {
  ImageQuickPipelineProps,
  QuickPipelineComponents,
  UploadBoxProps as PipelineUploadBoxProps,
  PreviewBoxProps as PipelinePreviewBoxProps,
  PresetSwitcherProps as PipelinePresetSwitcherProps,
  StepListBoxProps,
  DownloadButtonProps as PipelineDownloadButtonProps,
  ErrorDisplayProps as PipelineErrorDisplayProps,
  ResetButtonProps as PipelineResetButtonProps,
} from './ImageQuickPipeline';

// ─── Theme ────────────────────────────────────────────────
export { themeToCssVars, type QuickTheme } from './theme';
