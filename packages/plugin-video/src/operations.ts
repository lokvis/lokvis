/**
 * Video Capability 实现
 *
 * 通过 plugin-sdk 的 createBlobCapabilityImpl 工厂把 engine-video 的
 * Blob↔Blob 操作包装为 CapabilityImplementation:Asset[] + params → Asset[]
 *
 * 注意:engine-video 当前为占位实现,所有方法均抛出 "not implemented"。
 * merge / extract-audio / to-gif 三个能力在 engine-video 中尚无对应方法,
 * 这里直接抛错,待引擎实现后再切换为对应方法调用。
 */

import type { PluginContext, CapabilityImplementation } from '@lokvis/schema';
import { createBlobCapabilityImpl } from '@lokvis/plugin-sdk';
import { ffmpegEngine } from '@lokvis/engine-video';

/** Capability 名 → 操作函数的映射类型 */
export type VideoOperation = (
  blob: Blob,
  params: Record<string, unknown>
) => Promise<Blob>;

/** 视频能力实现项 */
export interface VideoCapabilityEntry {
  /** 对应 Capability 名 */
  capability: string;
  /** 引擎名 */
  engine: string;
  /** 实际执行函数(Blob → Blob) */
  operation: VideoOperation;
}

// ─── 各操作的参数转换 + 调用 ───────────────────────────────
// engine-video 操作函数已接受 Record<string, unknown>，无需类型断言。

const compressOp: VideoOperation = (blob, params) =>
  ffmpegEngine.compress(blob, params);

const transcodeOp: VideoOperation = (blob, params) =>
  ffmpegEngine.transcode(blob, params);

const trimOp: VideoOperation = (blob, params) =>
  ffmpegEngine.trim(blob, params);

const screenshotOp: VideoOperation = (blob, params) =>
  ffmpegEngine.screenshot(blob, params);

// engine-video 暂未提供以下三个方法,这里直接抛错,
// 待引擎实现后再切换为对应方法调用。
const mergeOp: VideoOperation = async () => {
  throw new Error('video.merge not implemented in engine-video stub');
};

const extractAudioOp: VideoOperation = async () => {
  throw new Error('video.extract-audio not implemented in engine-video stub');
};

const toGifOp: VideoOperation = async () => {
  throw new Error('video.to-gif not implemented in engine-video stub');
};

/** 全部视频能力实现项 */
export const VIDEO_CAPABILITY_ENTRIES: VideoCapabilityEntry[] = [
  { capability: 'video.compress',         engine: 'ffmpeg-wasm', operation: compressOp },
  { capability: 'video.transcode',        engine: 'ffmpeg-wasm', operation: transcodeOp },
  { capability: 'video.trim',             engine: 'ffmpeg-wasm', operation: trimOp },
  { capability: 'video.merge',            engine: 'ffmpeg-wasm', operation: mergeOp },
  { capability: 'video.extract-audio',    engine: 'ffmpeg-wasm', operation: extractAudioOp },
  { capability: 'video.to-gif',           engine: 'ffmpeg-wasm', operation: toGifOp },
  { capability: 'video.screenshot',       engine: 'ffmpeg-wasm', operation: screenshotOp },
];

/** engine-video stub 检测(AGENTS.md 约定:version.includes('stub')) */
const isStub = ffmpegEngine.version.includes('stub');

/**
 * 构造所有视频能力的 CapabilityImplementation
 * (由 plugin.ts 在 installer 中调用)
 */
export function buildVideoCapabilityImplementations(
  ctx: PluginContext
): CapabilityImplementation[] {
  return VIDEO_CAPABILITY_ENTRIES.map((entry) =>
    createBlobCapabilityImpl(
      {
        capability: entry.capability,
        engine: entry.engine,
        outputType: 'video',
        operation: entry.operation,
        isStub,
      },
      ctx
    )
  );
}
