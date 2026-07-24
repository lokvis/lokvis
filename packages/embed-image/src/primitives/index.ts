/**
 * Layer 1 primitives 入口(barrel)。
 *
 * 三方接入路径:
 *   import { ImageCompress } from '@lokvis/embed-image/primitives';
 *
 * 包含 6 个原语集合(覆盖 6 个工具),每个集合 8 个原语。
 */

// ─── Quick Compress ──────────────────────────────────────
export { ImageCompress } from './ImageCompress';
export type {
  ImageCompressRootProps,
  ImageCompressUploadProps,
  ImageCompressPresetSwitcherProps,
  ImageCompressPreviewProps,
  ImageCompressRatioBadgeProps,
  ImageCompressDownloadButtonProps,
  ImageCompressErrorDisplayProps,
  ImageCompressResetButtonProps,
} from './ImageCompress';

// ─── Quick Resize ────────────────────────────────────────
export { ImageResize } from './ImageResize';
export type {
  ImageResizeRootProps,
  ImageResizeUploadProps,
  ImageResizePresetSwitcherProps,
  ImageResizePreviewProps,
  ImageResizeDimensionBadgeProps,
  ImageResizeDownloadButtonProps,
  ImageResizeErrorDisplayProps,
  ImageResizeResetButtonProps,
} from './ImageResize';

// ─── Quick Convert ───────────────────────────────────────
export { ImageConvert } from './ImageConvert';
export type {
  ImageConvertRootProps,
  ImageConvertUploadProps,
  ImageConvertPresetSwitcherProps,
  ImageConvertPreviewProps,
  ImageConvertFormatBadgeProps,
  ImageConvertDownloadButtonProps,
  ImageConvertErrorDisplayProps,
  ImageConvertResetButtonProps,
} from './ImageConvert';

// ─── Quick Favicon ───────────────────────────────────────
export { ImageFavicon } from './ImageFavicon';
export type {
  ImageFaviconRootProps,
  ImageFaviconUploadProps,
  ImageFaviconPresetSwitcherProps,
  ImageFaviconPreviewProps,
  ImageFaviconSizeBadgeProps,
  ImageFaviconDownloadButtonProps,
  ImageFaviconErrorDisplayProps,
  ImageFaviconResetButtonProps,
} from './ImageFavicon';

// ─── Quick Watermark ─────────────────────────────────────
export { ImageWatermark } from './ImageWatermark';
export type {
  ImageWatermarkRootProps,
  ImageWatermarkUploadProps,
  ImageWatermarkPresetSwitcherProps,
  ImageWatermarkPreviewProps,
  ImageWatermarkTextInputProps,
  ImageWatermarkDownloadButtonProps,
  ImageWatermarkErrorDisplayProps,
  ImageWatermarkResetButtonProps,
} from './ImageWatermark';

// ─── Quick Crop ───────────────────────────────────────────
export { ImageCrop } from './ImageCrop';
export type {
  ImageCropRootProps,
  ImageCropUploadProps,
  ImageCropPresetSwitcherProps,
  ImageCropPreviewProps,
  ImageCropAreaProps,
  ImageCropDownloadButtonProps,
  ImageCropErrorDisplayProps,
  ImageCropResetButtonProps,
} from './ImageCrop';

// ─── Quick Pipeline ──────────────────────────────────────
export { ImagePipeline } from './ImagePipeline';
export type {
  ImagePipelineRootProps,
  ImagePipelineUploadProps,
  ImagePipelinePresetSwitcherProps,
  ImagePipelinePreviewProps,
  ImagePipelineStepListProps,
  ImagePipelineDownloadButtonProps,
  ImagePipelineErrorDisplayProps,
  ImagePipelineResetButtonProps,
} from './ImagePipeline';

// 共享工具(原语内部使用;导出便于三方自定义原语复用)
export {
  fileMatchesAccept,
  guessExtension,
  DefaultPresetButton,
  type DefaultPresetButtonProps,
} from './shared';
