/**
 * @lokvis/engine-audio/node
 *
 * Node.js 音频引擎,基于 ffmpeg-static 实现。
 *
 * 通过子路径 `@lokvis/engine-audio/node` 暴露,与浏览器主入口
 * `@lokvis/engine-audio` 分离(避免浏览器构建引入 ffmpeg-static 二进制)。
 *
 * 与浏览器引擎对齐的 4 个核心操作:
 * - trim / merge / transcode / normalize
 *
 * 设计原则:
 * - 操作函数签名与浏览器版完全一致(Blob → Blob + Record<string,any>)
 * - 不依赖 DOM API,仅用 Node 标准 API(child_process / fs / os / path)
 * - 类型定义共享 ../types.js(消除双源维护)
 *
 * 用途:
 * - MCP Server(Node 端 audio tool 的实际执行器)
 * - 离线批处理 / CI 流水线
 * - 浏览器未连接时的降级路径
 *
 * 参考:packages/engine-video/src/node/(模式对齐)
 */

// 通用类型从 ../types.js 复用(消除双源维护)
export type {
  AudioOutputFormat,
  AudioTrimParams,
  AudioMergeParams,
  AudioTranscodeParams,
  AudioNormalizeParams,
} from '../types.js';

export {
  trimAudio,
  mergeAudios,
  transcodeAudio,
  normalizeAudio,
} from './operations.js';

import type { AudioEngineDescriptor } from '../types.js';

/** Node 音频引擎描述符(ffmpeg-static)— 真实实现,version 不含 'stub' */
export const AUDIO_ENGINE: AudioEngineDescriptor = {
  name: 'ffmpeg-static',
  version: '0.7.1',
  supportedCapabilities: [
    'audio.trim',
    'audio.normalize',
    'audio.transcode',
    'audio.merge',
  ],
};

export type { AudioEngineDescriptor } from '../types.js';
