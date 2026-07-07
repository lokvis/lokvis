/**
 * @lokvis/engine-video
 *
 * 视频引擎适配层（Engine Adapter）。
 *
 * 计划支持的引擎：
 * - ffmpeg.wasm：通用视频编解码（依赖 SharedArrayBuffer）
 * - WebCodecs：浏览器原生硬件加速编解码
 *
 * 当前状态：MVP 占位实现。所有操作抛出 Not Implemented，
 * 后续按 whitepaper 04 §6.3 实现。
 *
 * 参考 docs/whitepaper/04-技术架构设计.md 第六节「Engine Layer」。
 */

import { createEngineRegistry } from '@lokvis/engine-core';
import type { AssetType } from '@lokvis/schema';

/** 视频引擎名标识 */
export type VideoEngineName = 'ffmpeg-wasm' | 'webcodecs';

/** 支持的视频输出格式 */
export type VideoOutputFormat = 'mp4' | 'webm' | 'gif';

/** 视频编解码参数 */
export interface VideoTranscodeParams {
  format: VideoOutputFormat;
  codec?: string;
  bitrate?: number;
  crf?: number;
}

/** 视频裁剪参数 */
export interface VideoTrimParams {
  start: number; // 秒
  end: number; // 秒
}

/** 视频压缩参数 */
export interface VideoCompressParams {
  format?: VideoOutputFormat;
  bitrate?: number;
  crf?: number;
  scale?: number; // 缩放比例 0-1
}

/** 解码后的视频帧信息 */
export interface DecodedVideo {
  width: number;
  height: number;
  duration: number;
  fps: number;
  codec: string;
}

/** 视频引擎适配器接口 */
export interface VideoEngineAdapter {
  name: VideoEngineName;
  version: string;
  supportedCapabilities: string[];
  isSupported(): Promise<boolean>;
  initialize?(): Promise<void>;
  dispose?(): Promise<void>;
  decode(blob: Blob): Promise<DecodedVideo>;
  transcode(blob: Blob, params: Record<string, any>): Promise<Blob>;
  compress(blob: Blob, params: Record<string, any>): Promise<Blob>;
  trim(blob: Blob, params: Record<string, any>): Promise<Blob>;
  screenshot(blob: Blob, params: Record<string, any>): Promise<Blob>;
}

/** ffmpeg.wasm 引擎占位实现 */
export const ffmpegEngine: VideoEngineAdapter = {
  name: 'ffmpeg-wasm',
  version: '0.0.0-stub',
  supportedCapabilities: [
    'video.compress',
    'video.transcode',
    'video.trim',
    'video.merge',
    'video.extract-audio',
    'video.to-gif',
    'video.screenshot',
  ],
  async isSupported() {
    // ffmpeg.wasm 需要 SharedArrayBuffer（COOP/COEP 隔离环境）
    return typeof SharedArrayBuffer !== 'undefined';
  },
  async decode() {
    throw new Error('ffmpegEngine.decode not implemented in stub');
  },
  async transcode() {
    throw new Error('ffmpegEngine.transcode not implemented in stub');
  },
  async compress() {
    throw new Error('ffmpegEngine.compress not implemented in stub');
  },
  async trim() {
    throw new Error('ffmpegEngine.trim not implemented in stub');
  },
  async screenshot() {
    throw new Error('ffmpegEngine.screenshot not implemented in stub');
  },
};

/** WebCodecs 引擎占位实现 */
export const webcodecsEngine: VideoEngineAdapter = {
  name: 'webcodecs',
  version: '0.0.0-stub',
  supportedCapabilities: ['video.transcode', 'video.compress'],
  async isSupported() {
    return typeof VideoEncoder !== 'undefined' && typeof VideoDecoder !== 'undefined';
  },
  async decode() {
    throw new Error('webcodecsEngine.decode not implemented in stub');
  },
  async transcode() {
    throw new Error('webcodecsEngine.transcode not implemented in stub');
  },
  async compress() {
    throw new Error('webcodecsEngine.compress not implemented in stub');
  },
  async trim() {
    throw new Error('webcodecsEngine.trim not implemented in stub');
  },
  async screenshot() {
    throw new Error('webcodecsEngine.screenshot not implemented in stub');
  },
};

// ─── 引擎注册表(委托 @lokvis/engine-core 工厂) ───────────
// 旧版手写 Map + register/get/list/selectBest 四个函数,与 engine-pdf /
// engine-audio / engine-ai 完全相同。改为 createEngineRegistry 一次构造,
// 消除四份重复样板。get(name?) 未命中时 fallback 到 ffmpegEngine。
const registry = createEngineRegistry<VideoEngineAdapter>(
  [ffmpegEngine, webcodecsEngine],
  ffmpegEngine
);

/** 注册视频引擎 */
export function registerVideoEngine(engine: VideoEngineAdapter): void {
  registry.register(engine);
}

/** 获取指定引擎 */
export function getVideoEngine(name?: VideoEngineName): VideoEngineAdapter {
  return registry.get(name);
}

/** 列出所有已注册引擎 */
export function listVideoEngines(): VideoEngineAdapter[] {
  return registry.list();
}

/** 异步选择最佳可用引擎 */
export async function selectBestVideoEngine(): Promise<VideoEngineAdapter> {
  return registry.selectBest();
}

export type { AssetType };
