/**
 * Layer 0 hooks 入口(barrel)。
 *
 * 三方接入路径:
 *   import { useImageCompress } from '@lokvis/embed-image/hooks';
 *
 * 包含 6 个 hook(覆盖 6 个工具):
 *   - useImageCompress:一键压缩
 *   - useImageResize:一键缩放
 *   - useImageConvert:一键格式转换
 *   - useImageWatermark:一键加水印
 *   - useImageCrop:一键裁剪
 *   - useImagePipeline:多步 pipeline
 *
 * 注:UseEmbedActionOptions / EmbedActionResult 是共享类型,
 * 只从 ./useImageCompress 导出一次(其他 hook 内部 re-export 自 useImageCompress)。
 */

// ─── Quick Compress ──────────────────────────────────────
export {
  useImageCompress,
  IMAGE_COMPRESS_PRESETS,
  type CompressPreset,
  type UseImageCompressOptions,
  type UseImageCompressResult,
  type UseEmbedActionOptions,
  type EmbedActionResult,
} from './useImageCompress';

// ─── Quick Resize ────────────────────────────────────────
export {
  useImageResize,
  IMAGE_RESIZE_PRESETS,
  type ResizePreset,
  type ResizePresetConfig,
  type ResizeCustomSize,
  type UseImageResizeOptions,
  type UseImageResizeResult,
} from './useImageResize';

// ─── Quick Convert ───────────────────────────────────────
export {
  useImageConvert,
  IMAGE_CONVERT_PRESETS,
  type ConvertPreset,
  type ConvertPresetConfig,
  type UseImageConvertResult,
} from './useImageConvert';

// ─── Quick Favicon ───────────────────────────────────────
export {
  useImageFavicon,
  IMAGE_FAVICON_PRESETS,
  type FaviconPreset,
  type FaviconPresetConfig,
  type UseImageFaviconResult,
} from './useImageFavicon';

// ─── Quick Watermark ─────────────────────────────────────
export {
  useImageWatermark,
  IMAGE_WATERMARK_PRESETS,
  DEFAULT_WATERMARK_TEXT,
  type WatermarkPreset,
  type WatermarkPresetConfig,
  type UseImageWatermarkOptions,
  type UseImageWatermarkResult,
} from './useImageWatermark';

// ─── Quick Crop ───────────────────────────────────────────
export {
  useImageCrop,
  IMAGE_CROP_PRESETS,
  computeCropRect,
  type CropPreset,
  type CropPresetConfig,
  type CropRect,
  type UseImageCropResult,
} from './useImageCrop';

// ─── Image Pipeline ──────────────────────────────────────
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
} from './useImagePipeline';
