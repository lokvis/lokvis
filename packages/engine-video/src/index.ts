/**
 * @lokvis/engine-video
 *
 * Video Engine 层 — Blob↔Blob 纯函数操作。
 *
 * 设计说明(与 engine-pdf 对齐):
 * - 本包暴露 7 个视频操作:compress / transcode / trim / merge / extractAudio /
 *   toGif / screenshot + 1 个元数据查询 getVideoInfo,全部为浏览器 stub
 * - 真实 Node 端操作经子路径 `@lokvis/engine-video/node` 导出(基于 ffmpeg-static)
 * - 浏览器端不加载 ffmpeg.wasm(体积大 ~30MB,且需 SharedArrayBuffer/COOP/COEP),
 *   所有操作抛 stub 错误,CapabilityRegistry.resolve() 自动跳过
 * - AGENTS.md:Engine 层只暴露 Blob↔Blob 纯函数,不感知 Asset/Workflow
 *
 * 与旧版(0.2.x)的差异:
 * - 移除 VideoEngineAdapter 接口与 ffmpegEngine / webcodecsEngine stub 占位
 * - 移除 registerVideoEngine / getVideoEngine / listVideoEngines / selectBestVideoEngine
 *   注册表 API(无外部消费方,plugin-video 已迁移到独立操作模式)
 * - 改为独立纯函数(compressVideo / transcodeVideo / ...),与 engine-pdf 一致
 *
 * 参考 docs/whitepaper/04-技术架构设计.md 第六节「Engine Layer」。
 */

export {
  compressVideo,
  transcodeVideo,
  trimVideo,
  mergeVideos,
  extractAudio,
  toGif,
  screenshotVideo,
  getVideoInfo,
} from './operations.js';

export type {
  VideoOutputFormat,
  VideoTranscodeParams,
  VideoTrimParams,
  VideoCompressParams,
  VideoMergeParams,
  VideoExtractAudioParams,
  VideoToGifParams,
  VideoScreenshotParams,
  VideoInfo,
} from './types.js';
