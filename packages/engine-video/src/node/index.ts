/**
 * @lokvis/engine-video/node
 *
 * Node.js 视频引擎,基于 ffmpeg-static 实现。
 *
 * 通过子路径 `@lokvis/engine-video/node` 暴露,与浏览器主入口
 * `@lokvis/engine-video` 分离(避免浏览器构建引入 ffmpeg-static 二进制)。
 *
 * 与浏览器引擎对齐的 7 个核心操作:
 * - compress / transcode / trim / merge / extractAudio / toGif / screenshot
 *
 * 设计原则:
 * - 操作函数签名与浏览器版完全一致(Blob → Blob + Record<string,any>)
 * - 不依赖 DOM API,仅用 Node 标准 API(child_process / fs / os / path)
 * - 类型定义共享 ../types.js(消除双源维护)
 *
 * 用途:
 * - MCP Server(Node 端 video tool 的实际执行器)
 * - 离线批处理 / CI 流水线
 * - 浏览器未连接时的降级路径
 *
 * 参考:packages/engine-image/src/node/(模式对齐)
 */

// 通用类型从 ../types.js 复用(消除双源维护)
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
} from '../types.js';

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

import type { VideoEngineDescriptor } from '../types.js';

/** Node 视频引擎描述符(ffmpeg-static)— 真实实现,version 不含 'stub' */
export const VIDEO_ENGINE: VideoEngineDescriptor = {
  name: 'ffmpeg-static',
  version: '0.7.1',
};

export type { VideoEngineDescriptor } from '../types.js';
