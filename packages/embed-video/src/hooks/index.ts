/**
 * Layer 0 hooks 入口(barrel)。
 *
 * 三方接入路径:
 *   import { useVideoCompress } from '@lokvis/embed-video/hooks';
 *
 * 包含 7 个 hook(覆盖 7 个工具):
 *   - useVideoCompress:视频压缩
 *   - useVideoTranscode:格式转码
 *   - useVideoTrim:裁剪时间段
 *   - useVideoMerge:多视频拼接
 *   - useVideoToGif:转 GIF
 *   - useVideoScreenshot:截帧
 *   - useVideoExtractAudio:提取音频
 *
 * 注:当前浏览器引擎为 stub,调用后 error 状态体现"能力不可用"。
 * 引擎实装后(wasm / remote backend)hooks 零改动生效。
 * 三方可通过 plugins 选项注入自定义处理插件。
 */

export {
  useVideoCompress,
  VIDEO_COMPRESS_PRESETS,
  type VideoCompressPreset,
  type UseVideoActionOptions,
  type VideoActionResult,
  type UseVideoCompressResult,
} from './useVideoCompress';

export {
  useVideoTranscode,
  VIDEO_TRANSCODE_PRESETS,
  type VideoTranscodePreset,
  type UseVideoTranscodeResult,
} from './useVideoTranscode';

export {
  useVideoTrim,
  type UseVideoTrimOptions,
  type UseVideoTrimResult,
} from './useVideoTrim';

export {
  useVideoMerge,
  type UseVideoMergeOptions,
  type UseVideoMergeResult,
} from './useVideoMerge';

export {
  useVideoToGif,
  VIDEO_TO_GIF_PRESETS,
  type VideoToGifPreset,
  type UseVideoToGifResult,
} from './useVideoToGif';

export {
  useVideoScreenshot,
  VIDEO_SCREENSHOT_PRESETS,
  type VideoScreenshotPreset,
  type UseVideoScreenshotResult,
} from './useVideoScreenshot';

export {
  useVideoExtractAudio,
  VIDEO_EXTRACT_AUDIO_PRESETS,
  type VideoExtractAudioPreset,
  type UseVideoExtractAudioResult,
} from './useVideoExtractAudio';
