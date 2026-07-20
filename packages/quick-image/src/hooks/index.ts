/**
 * Layer 0 hooks 入口(barrel)。
 *
 * 三方接入路径:
 *   import { useQuickCompress } from '@lokvis/quick-image/hooks';
 *
 * 包含 6 个 hook(覆盖 6 个工具):
 *   - useQuickCompress:一键压缩
 *   - useQuickResize:一键缩放
 *   - useQuickConvert:一键格式转换
 *   - useQuickWatermark:一键加水印
 *   - useQuickCrop:一键裁剪
 *   - useImagePipeline:多步 pipeline
 *
 * 注:UseQuickActionOptions / QuickActionResult 是共享类型,
 * 只从 ./useQuickCompress 导出一次(其他 hook 内部 re-export 自 useQuickCompress)。
 */

// ─── Quick Compress ──────────────────────────────────────
export {
  useQuickCompress,
  COMPRESS_PRESETS,
  type CompressPreset,
  type UseQuickCompressResult,
  type UseQuickActionOptions,
  type QuickActionResult,
} from './useQuickCompress';

// ─── Quick Resize ────────────────────────────────────────
export {
  useQuickResize,
  RESIZE_PRESETS,
  type ResizePreset,
  type ResizePresetConfig,
  type UseQuickResizeResult,
} from './useQuickResize';

// ─── Quick Convert ───────────────────────────────────────
export {
  useQuickConvert,
  CONVERT_PRESETS,
  type ConvertPreset,
  type ConvertPresetConfig,
  type UseQuickConvertResult,
} from './useQuickConvert';

// ─── Quick Watermark ─────────────────────────────────────
export {
  useQuickWatermark,
  WATERMARK_PRESETS,
  DEFAULT_WATERMARK_TEXT,
  type WatermarkPreset,
  type WatermarkPresetConfig,
  type UseQuickWatermarkOptions,
  type UseQuickWatermarkResult,
} from './useQuickWatermark';

// ─── Quick Crop ───────────────────────────────────────────
export {
  useQuickCrop,
  CROP_PRESETS,
  computeCropRect,
  type CropPreset,
  type CropPresetConfig,
  type CropRect,
  type UseQuickCropResult,
} from './useQuickCrop';

// ─── Image Pipeline ──────────────────────────────────────
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
} from './useImagePipeline';
