/**
 * Video Capability 实现
 *
 * 通过 plugin-sdk 的 createBlobCapabilityImpl / createMergeCapabilityImpl 工厂
 * 把 engine-video 的 Blob↔Blob 操作包装为 CapabilityImplementation:
 * Asset[] + params → Asset[]
 *
 * 两种形态:
 * - single(1→1):compress / transcode / trim / extract-audio / to-gif / screenshot
 * - merge(N→1):video.merge
 *
 * 注意:engine-video 当前为占位实现,所有方法均抛出 "not implemented in stub",
 * 因此 plugin-video 的各操作在运行时也会抛出 —— 这是有意为之的 stub 行为。
 *
 * 能力声明(VIDEO_CAPABILITIES)由 codegen 从 manifests/video.manifest.json 生成,
 * 见 packages/capability/src/presets/video.generated.ts。本文件只负责 impl 绑定
 * (capability name → engine + operation)。
 */

import type {
  AssetMetadata,
  AssetType,
  CapabilityImplementation,
  PluginContext,
} from '@lokvis/schema';
import {
  createBlobCapabilityImpl,
  createMergeCapabilityImpl,
} from '@lokvis/plugin-sdk';
import { ffmpegEngine } from '@lokvis/engine-video';

/** 单输入 → 单输出操作(1→1) */
export type VideoOperation = (
  blob: Blob,
  params: Record<string, unknown>
) => Promise<Blob>;

/** 多输入 → 单输出操作(N→1,merge) */
export type MergeVideoOperation = (
  blobs: Blob[],
  params: Record<string, unknown>
) => Promise<Blob>;

/** 视频能力实现绑定项(capability name → engine + operation) */
export interface VideoOperationEntry {
  /** 对应 Capability 名(与 generated 声明的 name 字段关联) */
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

const extractAudioOp: VideoOperation = (blob, params) =>
  ffmpegEngine.extractAudio(blob, params);

const toGifOp: VideoOperation = (blob, params) =>
  ffmpegEngine.toGif(blob, params);

/** video.merge:N→1,委托 ffmpegEngine.merge */
const mergeOp: MergeVideoOperation = (blobs, params) =>
  ffmpegEngine.merge(blobs, params);

/** 1→1 能力实现绑定(merge 单独走 createMergeCapabilityImpl) */
export const VIDEO_OPERATION_ENTRIES: VideoOperationEntry[] = [
  { capability: 'video.compress',         engine: 'ffmpeg-wasm', operation: compressOp },
  { capability: 'video.transcode',        engine: 'ffmpeg-wasm', operation: transcodeOp },
  { capability: 'video.trim',             engine: 'ffmpeg-wasm', operation: trimOp },
  { capability: 'video.extract-audio',    engine: 'ffmpeg-wasm', operation: extractAudioOp },
  { capability: 'video.to-gif',           engine: 'ffmpeg-wasm', operation: toGifOp },
  { capability: 'video.screenshot',       engine: 'ffmpeg-wasm', operation: screenshotOp },
];

/** engine-video stub 检测(AGENTS.md 约定:version.includes('stub')) */
const isStub = ffmpegEngine.version.includes('stub');

/** 从输出 Blob 派生 video 类型 Asset 元数据(不传播 dimensions,需解码才能获得) */
function deriveVideoMetadata(outBlob: Blob): AssetMetadata {
  const mimeType = outBlob.type || 'video/mp4';
  const format = mimeType.split('/')[1] ?? 'mp4';
  return { mimeType, size: outBlob.size, format };
}

/** video.merge 输出类型(GIF 走 to-gif,merge 通常是视频格式) */
const MERGE_OUTPUT_TYPE: AssetType = 'video';

/**
 * 构造所有视频能力的 CapabilityImplementation
 * (由 plugin.ts 在 installer 中调用)
 *
 * stub 标识在此一次性完成(AGENTS.md 约定:version.includes('stub')),
 * 不再在 merge 包装函数中重复检测。
 */
export function buildVideoCapabilityImplementations(
  ctx: PluginContext
): CapabilityImplementation[] {
  const singleImpls = VIDEO_OPERATION_ENTRIES.map((entry) =>
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

  // merge 是 N→1 形态,单独走 createMergeCapabilityImpl
  const mergeImpl = createMergeCapabilityImpl(
    {
      capability: 'video.merge',
      engine: 'ffmpeg-wasm',
      outputType: MERGE_OUTPUT_TYPE,
      operation: mergeOp,
      isStub,
      deriveMetadata: deriveVideoMetadata,
    },
    ctx
  );

  return [...singleImpls, mergeImpl];
}
