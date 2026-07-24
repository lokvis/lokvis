/**
 * @lokvis/embed-video
 *
 * 三层 Video 工具组件,供三方快速接入:
 *
 * 接入路径(按自由度递增):
 *   1. 零配置:<VideoCompress.Root>...</VideoCompress.Root>
 *   2. 原语组装:Layer 1 primitives
 *   3. 纯 hooks:useVideoCompress() 完全自建 UI
 *
 * 当前浏览器引擎为 stub,调用后 error 状态体现"能力不可用"。
 * 引擎实装后(wasm / remote backend)hooks 零改动生效。
 * 三方可通过 plugins 选项注入自定义处理插件(如 remote-processing plugin)。
 *
 * 子路径导出:
 *   - '@lokvis/embed-video'            全量(Layer 0+1 + utilities)
 *   - '@lokvis/embed-video/hooks'      仅 Layer 0(无头 hooks)
 *   - '@lokvis/embed-video/primitives' 仅 Layer 1(无样式原语)
 *   - '@lokvis/embed-video/styles.css' CSS 变量主题
 */

// ─── Layer 0: Hooks ──────────────────────────────────────
export {
  useVideoCompress,
  useVideoTranscode,
  useVideoTrim,
  useVideoMerge,
  useVideoToGif,
  useVideoScreenshot,
  useVideoExtractAudio,
  VIDEO_COMPRESS_PRESETS,
  VIDEO_TRANSCODE_PRESETS,
  VIDEO_TO_GIF_PRESETS,
  VIDEO_SCREENSHOT_PRESETS,
  VIDEO_EXTRACT_AUDIO_PRESETS,
  type VideoCompressPreset,
  type VideoTranscodePreset,
  type VideoToGifPreset,
  type VideoScreenshotPreset,
  type VideoExtractAudioPreset,
  type UseVideoActionOptions,
  type VideoActionResult,
  type UseVideoCompressResult,
  type UseVideoTranscodeResult,
  type UseVideoTrimOptions,
  type UseVideoTrimResult,
  type UseVideoMergeOptions,
  type UseVideoMergeResult,
  type UseVideoToGifResult,
  type UseVideoScreenshotResult,
  type UseVideoExtractAudioResult,
} from './hooks/index';

// ─── Layer 1: Primitives ─────────────────────────────────
export {
  VideoCompress,
  fileMatchesVideo,
  DefaultPresetButton,
} from './primitives/index';

// ─── Utilities ───────────────────────────────────────────
export { getVideoFileInfo, downloadBlob, formatBytes, formatDuration, type VideoFileInfo } from './internal/download';
