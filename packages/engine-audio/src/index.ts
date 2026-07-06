/**
 * @lokvis/engine-audio
 *
 * 音频引擎适配层。
 *
 * 计划支持的引擎：
 * - Web Audio API：浏览器原生（解码、混音、特效）
 * - lamejs：MP3 编码
 *
 * 当前状态：MVP 占位实现。
 */

import { createEngineRegistry } from '@lokvis/engine-core';
import type { AssetType } from '@lokvis/schema';

/** 音频引擎名 */
export type AudioEngineName = 'web-audio' | 'lamejs';

/** 音频输出格式 */
export type AudioOutputFormat = 'mp3' | 'wav' | 'ogg' | 'aac';

/** 音频转码参数 */
export interface AudioTranscodeParams {
  format: AudioOutputFormat;
  bitrate?: number;
}

/** 音频裁剪参数 */
export interface AudioTrimParams {
  start: number; // 秒
  end: number;
}

/** 音频标准化参数 */
export interface AudioNormalizeParams {
  level?: number; // 目标响度（dB）
}

/** 解码后的音频信息 */
export interface DecodedAudio {
  duration: number;
  sampleRate: number;
  channels: number;
  bitrate?: number;
  codec: string;
}

/** 音频引擎适配器接口 */
export interface AudioEngineAdapter {
  name: AudioEngineName;
  version: string;
  supportedCapabilities: string[];
  isSupported(): Promise<boolean>;
  initialize?(): Promise<void>;
  dispose?(): Promise<void>;
  decode(blob: Blob): Promise<DecodedAudio>;
  transcode(blob: Blob, params: AudioTranscodeParams): Promise<Blob>;
  trim(blob: Blob, params: AudioTrimParams): Promise<Blob>;
  normalize(blob: Blob, params: AudioNormalizeParams): Promise<Blob>;
  merge(blobs: Blob[]): Promise<Blob>;
}

/** Web Audio 引擎占位实现 */
export const webAudioEngine: AudioEngineAdapter = {
  name: 'web-audio',
  version: '0.0.0-stub',
  supportedCapabilities: ['audio.trim', 'audio.normalize', 'audio.merge'],
  async isSupported() {
    return (
      typeof AudioContext !== 'undefined' ||
      typeof (globalThis as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext !== 'undefined'
    );
  },
  async decode() {
    throw new Error('webAudioEngine.decode not implemented in stub');
  },
  async transcode() {
    throw new Error('webAudioEngine.transcode not implemented in stub');
  },
  async trim() {
    throw new Error('webAudioEngine.trim not implemented in stub');
  },
  async normalize() {
    throw new Error('webAudioEngine.normalize not implemented in stub');
  },
  async merge() {
    throw new Error('webAudioEngine.merge not implemented in stub');
  },
};

/** lamejs 引擎占位实现（仅 MP3 编码） */
export const lamejsEngine: AudioEngineAdapter = {
  name: 'lamejs',
  version: '0.0.0-stub',
  supportedCapabilities: ['audio.transcode'],
  async isSupported() {
    return true;
  },
  async decode() {
    throw new Error('lamejsEngine.decode not implemented in stub');
  },
  async transcode() {
    throw new Error('lamejsEngine.transcode not implemented in stub');
  },
  async trim() {
    throw new Error('lamejsEngine cannot trim (encoder-only)');
  },
  async normalize() {
    throw new Error('lamejsEngine cannot normalize (encoder-only)');
  },
  async merge() {
    throw new Error('lamejsEngine cannot merge (encoder-only)');
  },
};

// ─── 引擎注册表(委托 @lokvis/engine-core 工厂) ───────────
// 旧版手写 Map + register/get/list/selectBest 四个函数,与 engine-pdf /
// engine-video / engine-ai 完全相同。改为 createEngineRegistry 一次构造,
// 消除四份重复样板。get(name?) 未命中时 fallback 到 webAudioEngine。
const registry = createEngineRegistry<AudioEngineAdapter>(
  [webAudioEngine, lamejsEngine],
  webAudioEngine
);

export function registerAudioEngine(engine: AudioEngineAdapter): void {
  registry.register(engine);
}

export function getAudioEngine(name?: AudioEngineName): AudioEngineAdapter {
  return registry.get(name);
}

export function listAudioEngines(): AudioEngineAdapter[] {
  return registry.list();
}

export async function selectBestAudioEngine(): Promise<AudioEngineAdapter> {
  return registry.selectBest();
}

export type { AssetType };
