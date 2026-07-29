/**
 * @lokvis/engine-audio
 *
 * Audio Engine 层 — Blob↔Blob 纯函数操作。
 *
 * 设计说明(与 engine-video / engine-pdf 对齐):
 * - 本包暴露 4 个音频操作:trim / merge / transcode / normalize,全部为浏览器 stub
 * - 真实 Node 端操作经子路径 `@lokvis/engine-audio/node` 导出(基于 ffmpeg-static)
 * - 浏览器端不加载 lamejs + Web Audio 解码器(跨容器支持有限,且体积大),
 *   所有操作抛 stub 错误,CapabilityRegistry.resolve() 自动跳过
 * - AGENTS.md:Engine 层只暴露 Blob↔Blob 纯函数,不感知 Asset/Workflow
 *
 * 与旧版(0.2.x)的差异:
 * - 移除 AudioEngineAdapter 接口与 webAudioEngine / lamejsEngine stub 占位
 * - 移除 registerAudioEngine / getAudioEngine / listAudioEngines / selectBestAudioEngine
 *   注册表 API(无外部消费方,plugin-audio 已迁移到独立操作模式)
 * - 移除 @lokvis/engine-core 依赖(注册表样板不再需要)
 * - 改为独立纯函数(trimAudio / mergeAudios / transcodeAudio / normalizeAudio),
 *   与 engine-video 一致
 *
 * 参考 docs/whitepaper/04-技术架构设计.md 第六节「Engine Layer」。
 */

export {
  trimAudio,
  mergeAudios,
  transcodeAudio,
  normalizeAudio,
} from './operations.js';

import type { AudioEngineDescriptor } from './types.js';

/**
 * 默认(浏览器)音频引擎描述符 — 占位实现。
 *
 * version 含 'stub',plugin-audio 默认入口据此推导 isStub=true。
 * 真实实现见子路径 `@lokvis/engine-audio/node`(ffmpeg-static)。
 */
export const AUDIO_ENGINE: AudioEngineDescriptor = {
  name: 'ffmpeg-wasm',
  version: '0.7.1-stub',
};

export type {
  AudioEngineDescriptor,
  AudioOutputFormat,
  AudioTrimParams,
  AudioMergeParams,
  AudioTranscodeParams,
  AudioNormalizeParams,
} from './types.js';
