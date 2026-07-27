/**
 * @lokvis/embed-image — Image Workspace Quick Actions 三层架构。
 *
 * 三层架构(见 docs/reports/20260719-image-workspace-ui-design.md):
 *   - Layer 0:Headless Hook(useImageCompress,纯逻辑,无 UI)
 *   - Layer 1:Unstyled Primitives(ImageCompress,无样式,有行为)
 *   - Layer 2:Default UI(EmbedImageCompress,Tailwind 默认样式)
 *
 * 三方接入路径(按自由度递增):
 *   1. 零配置:      <EmbedImageCompress />
 *   2. 主题定制:    <EmbedImageCompress theme={{...}} />
 *   3. CSS 变量:    覆盖 .lokvis-quick-compress { --lokvis-* }
 *   4. 组件替换:    <EmbedImageCompress components={{...}} />
 *   5. 原语组装:    <ImageCompress.Root>...</ImageCompress.Root>
 *   6. 完全自定义:  useImageCompress() hook
 *
 * 子路径导出:
 *   - '@lokvis/embed-image'             — 全量(Layer 0/1/2 + 主题)
 *   - '@lokvis/embed-image/hooks'       — 仅 Layer 0 hooks
 *   - '@lokvis/embed-image/primitives'  — 仅 Layer 1 primitives
 */

// ─── Quick Compress ───────────────────────────────────────

// Layer 0:Hook
export {
  useImageCompress,
  IMAGE_COMPRESS_PRESETS,
  type CompressPreset,
  type UseImageCompressOptions,
  type UseImageCompressResult,
  type UseEmbedActionOptions,
  type EmbedActionResult,
} from './hooks/useImageCompress';

// Layer 1:Primitives
export { ImageCompress } from './primitives/ImageCompress';
export type {
  ImageCompressRootProps,
  ImageCompressUploadProps,
  ImageCompressPresetSwitcherProps,
  ImageCompressPreviewProps,
  ImageCompressRatioBadgeProps,
  ImageCompressDownloadButtonProps,
  ImageCompressErrorDisplayProps,
  ImageCompressResetButtonProps,
} from './primitives/ImageCompress';

// Layer 2:Default UI
export { default as EmbedImageCompress } from './EmbedImageCompress';
export type {
  EmbedImageCompressProps,
  ImageCompressComponents,
  UploadBoxProps as CompressUploadBoxProps,
  PreviewBoxProps as CompressPreviewBoxProps,
  PresetSwitcherProps as CompressPresetSwitcherProps,
  DownloadButtonProps as CompressDownloadButtonProps,
  RatioBadgeProps,
  ErrorDisplayProps as CompressErrorDisplayProps,
  ResetButtonProps as CompressResetButtonProps,
} from './EmbedImageCompress';

// ─── Quick Resize ─────────────────────────────────────────

// Layer 0:Hook
export {
  useImageResize,
  IMAGE_RESIZE_PRESETS,
  type ResizePreset,
  type ResizePresetConfig,
  type ResizeCustomSize,
  type UseImageResizeOptions,
  type UseImageResizeResult,
} from './hooks/useImageResize';

// Layer 1:Primitives
export { ImageResize } from './primitives/ImageResize';
export type {
  ImageResizeRootProps,
  ImageResizeUploadProps,
  ImageResizePresetSwitcherProps,
  ImageResizePreviewProps,
  ImageResizeDimensionBadgeProps,
  ImageResizeDownloadButtonProps,
  ImageResizeErrorDisplayProps,
  ImageResizeResetButtonProps,
} from './primitives/ImageResize';

// Layer 2:Default UI
export { default as EmbedImageResize } from './EmbedImageResize';
export type {
  EmbedImageResizeProps,
  ImageResizeComponents,
  UploadBoxProps as ResizeUploadBoxProps,
  PreviewBoxProps as ResizePreviewBoxProps,
  PresetSwitcherProps as ResizePresetSwitcherProps,
  DownloadButtonProps as ResizeDownloadButtonProps,
  DimensionBadgeProps,
  ErrorDisplayProps as ResizeErrorDisplayProps,
  ResetButtonProps as ResizeResetButtonProps,
} from './EmbedImageResize';

// ─── Quick Convert ────────────────────────────────────────

// Layer 0:Hook
export {
  useImageConvert,
  IMAGE_CONVERT_PRESETS,
  type ConvertPreset,
  type ConvertPresetConfig,
  type UseImageConvertResult,
} from './hooks/useImageConvert';

// Layer 1:Primitives
export { ImageConvert } from './primitives/ImageConvert';
export type {
  ImageConvertRootProps,
  ImageConvertUploadProps,
  ImageConvertPresetSwitcherProps,
  ImageConvertPreviewProps,
  ImageConvertFormatBadgeProps,
  ImageConvertDownloadButtonProps,
  ImageConvertErrorDisplayProps,
  ImageConvertResetButtonProps,
} from './primitives/ImageConvert';

// Layer 2:Default UI
export { default as EmbedImageConvert } from './EmbedImageConvert';
export type {
  EmbedImageConvertProps,
  ImageConvertComponents,
  UploadBoxProps as ConvertUploadBoxProps,
  PreviewBoxProps as ConvertPreviewBoxProps,
  PresetSwitcherProps as ConvertPresetSwitcherProps,
  DownloadButtonProps as ConvertDownloadButtonProps,
  FormatBadgeProps,
  ErrorDisplayProps as ConvertErrorDisplayProps,
  ResetButtonProps as ConvertResetButtonProps,
} from './EmbedImageConvert';

// ─── Quick Favicon ────────────────────────────────────────

// Layer 0:Hook
export {
  useImageFavicon,
  IMAGE_FAVICON_PRESETS,
  type FaviconPreset,
  type FaviconPresetConfig,
  type UseImageFaviconResult,
} from './hooks/useImageFavicon';

// Layer 1:Primitives
export { ImageFavicon } from './primitives/ImageFavicon';
export type {
  ImageFaviconRootProps,
  ImageFaviconUploadProps,
  ImageFaviconPresetSwitcherProps,
  ImageFaviconPreviewProps,
  ImageFaviconSizeBadgeProps,
  ImageFaviconDownloadButtonProps,
  ImageFaviconErrorDisplayProps,
  ImageFaviconResetButtonProps,
} from './primitives/ImageFavicon';

// Layer 2:Default UI
export { default as EmbedImageFavicon } from './EmbedImageFavicon';
export type {
  EmbedImageFaviconProps,
  ImageFaviconComponents,
  UploadBoxProps as FaviconUploadBoxProps,
  PreviewBoxProps as FaviconPreviewBoxProps,
  PresetSwitcherProps as FaviconPresetSwitcherProps,
  DownloadButtonProps as FaviconDownloadButtonProps,
  SizeBadgeProps,
  ErrorDisplayProps as FaviconErrorDisplayProps,
  ResetButtonProps as FaviconResetButtonProps,
} from './EmbedImageFavicon';

// ─── Quick Watermark ─────────────────────────────────────

// Layer 0:Hook
export {
  useImageWatermark,
  IMAGE_WATERMARK_PRESETS,
  DEFAULT_WATERMARK_TEXT,
  type WatermarkPreset,
  type WatermarkPresetConfig,
  type UseImageWatermarkOptions,
  type UseImageWatermarkResult,
} from './hooks/useImageWatermark';

// Layer 1:Primitives
export { ImageWatermark } from './primitives/ImageWatermark';
export type {
  ImageWatermarkRootProps,
  ImageWatermarkUploadProps,
  ImageWatermarkPresetSwitcherProps,
  ImageWatermarkPreviewProps,
  ImageWatermarkTextInputProps,
  ImageWatermarkDownloadButtonProps,
  ImageWatermarkErrorDisplayProps,
  ImageWatermarkResetButtonProps,
} from './primitives/ImageWatermark';

// Layer 2:Default UI
export { default as EmbedImageWatermark } from './EmbedImageWatermark';
export type {
  EmbedImageWatermarkProps,
  ImageWatermarkComponents,
  UploadBoxProps as WatermarkUploadBoxProps,
  PreviewBoxProps as WatermarkPreviewBoxProps,
  PresetSwitcherProps as WatermarkPresetSwitcherProps,
  TextInputProps as WatermarkTextInputProps,
  DownloadButtonProps as WatermarkDownloadButtonProps,
  ErrorDisplayProps as WatermarkErrorDisplayProps,
  ResetButtonProps as WatermarkResetButtonProps,
} from './EmbedImageWatermark';

// ─── Quick Crop ───────────────────────────────────────────

// Layer 0:Hook
export {
  useImageCrop,
  IMAGE_CROP_PRESETS,
  computeCropRect,
  type CropPreset,
  type CropPresetConfig,
  type CropRect,
  type UseImageCropResult,
} from './hooks/useImageCrop';

// Layer 1:Primitives
export { ImageCrop } from './primitives/ImageCrop';
export type {
  ImageCropRootProps,
  ImageCropUploadProps,
  ImageCropPresetSwitcherProps,
  ImageCropPreviewProps,
  ImageCropAreaProps,
  ImageCropDownloadButtonProps,
  ImageCropErrorDisplayProps,
  ImageCropResetButtonProps,
} from './primitives/ImageCrop';

// Layer 2:Default UI
export { default as EmbedImageCrop } from './EmbedImageCrop';
export type {
  EmbedImageCropProps,
  ImageCropComponents,
  UploadBoxProps as CropUploadBoxProps,
  PreviewBoxProps as CropPreviewBoxProps,
  PresetSwitcherProps as CropPresetSwitcherProps,
  CropAreaBoxProps,
  DownloadButtonProps as CropDownloadButtonProps,
  ErrorDisplayProps as CropErrorDisplayProps,
  ResetButtonProps as CropResetButtonProps,
} from './EmbedImageCrop';

// ─── Quick Pipeline ───────────────────────────────────────

// Layer 0:Hook
export {
  useImagePipeline,
  IMAGE_PIPELINE_PRESETS,
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
export { ImagePipeline } from './primitives/ImagePipeline';
export type {
  ImagePipelineRootProps,
  ImagePipelineUploadProps,
  ImagePipelinePresetSwitcherProps,
  ImagePipelinePreviewProps,
  ImagePipelineStepListProps,
  ImagePipelineDownloadButtonProps,
  ImagePipelineErrorDisplayProps,
  ImagePipelineResetButtonProps,
} from './primitives/ImagePipeline';

// Layer 2:Default UI
export { default as EmbedImagePipeline } from './EmbedImagePipeline';
export type {
  EmbedImagePipelineProps,
  ImagePipelineComponents,
  UploadBoxProps as PipelineUploadBoxProps,
  PreviewBoxProps as PipelinePreviewBoxProps,
  PresetSwitcherProps as PipelinePresetSwitcherProps,
  StepListBoxProps,
  DownloadButtonProps as PipelineDownloadButtonProps,
  ErrorDisplayProps as PipelineErrorDisplayProps,
  ResetButtonProps as PipelineResetButtonProps,
} from './EmbedImagePipeline';

// ─── Batch(纯 Layer 0,无内置 UI) ───────────────────────
export {
  useImageBatch,
  type BatchItem,
  type BatchSummary,
  type UseImageBatchOptions,
  type UseImageBatchResult,
} from './hooks/useImageBatch';

// ─── 共享类型 ─────────────────────────────────────────────
// ImageInfo 出现在所有 hook 的返回值(inputInfo/outputInfo)与
// FileInfoBar slot 契约中,从包入口导出供三方标注类型。
export type { ImageInfo } from './internal/download';
export { formatBytes } from './internal/download';
// BusyOverlay / FileInfoBar 是 6 个 Layer-2 组件共有的 components slot,
// 三方实现替换组件时需要这两个 Props 契约。
export type { BusyOverlayProps, FileInfoBarProps } from './internal/shared-ui';

// ─── Theme ────────────────────────────────────────────────
export { themeToCssVars, useEmbedMode, type EmbedTheme, type EmbedMode } from './theme';

// ─── i18n(Task 2 解耦) ──────────────────────────────────
// EmbedI18nProvider:让消费方显式注入 locale + 可选翻译覆盖,
// 而不依赖 playground 的 <html lang> / URL 路径前缀。
export {
  EmbedI18nProvider,
  useQuickI18nContext,
  type EmbedI18nProviderProps,
  type QuickI18nContextValue,
  type EmbedTranslations,
} from './i18n/EmbedI18nProvider';
export type { Language } from './i18n/config';
