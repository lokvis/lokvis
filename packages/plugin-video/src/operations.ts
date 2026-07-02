/**
 * Video Capability 实现
 *
 * 把 engine-video 的 Blob ↔ Blob 操作包装为 CapabilityImplementation：
 *   Asset[] + params → Asset[]
 *
 * 关键流程：
 *   1. 通过 ctx.runtime.getAssetBlob 读取输入 Asset 的 Blob
 *   2. 调用 engine-video 对应操作（compress / transcode / trim / screenshot）
 *   3. 通过 ctx.runtime.createAsset 把输出 Blob 注册为新 Asset
 *
 * 注意：engine-video 当前为占位实现，所有方法均抛出 "not implemented"。
 * merge / extract-audio / to-gif 三个能力在 engine-video 中尚无对应方法，
 * 这里直接抛错，待引擎实现后再切换为对应方法调用。
 */

import type {
  Asset,
  CapabilityImplementation,
  ExecutionContext,
} from '@lokvis/schema';
import type { PluginContext } from '@lokvis/schema';
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
  /** 实际执行函数（Blob → Blob） */
  operation: VideoOperation;
}

/** 将 Blob 操作包装为标准 CapabilityImplementation */
function wrapAsImplementation(
  entry: VideoCapabilityEntry,
  ctx: PluginContext
): CapabilityImplementation {
  const isStub = ffmpegEngine.version.includes('stub');
  return {
    capability: entry.capability,
    engine: entry.engine,
    status: isStub ? 'stub' : 'stable',
    async execute(inputs: Asset[], params: Record<string, unknown>, execCtx: ExecutionContext): Promise<Asset[]> {
      if (inputs.length === 0) {
        throw new Error(`Capability "${entry.capability}" requires at least one input asset`);
      }
      const outputs: Asset[] = [];
      for (let i = 0; i < inputs.length; i++) {
        if (execCtx.signal.aborted) {
          throw new DOMException('Aborted', 'AbortError');
        }
        const asset = inputs[i]!;
        execCtx.onProgress?.(i / inputs.length, `Processing ${i + 1}/${inputs.length}`);
        const blob = await ctx.runtime.getAssetBlob(asset);
        const outBlob = await entry.operation(blob, params);
        const metadata = deriveOutputMetadata(asset, outBlob);
        const outAsset = await ctx.runtime.createAsset(outBlob, metadata, 'video');
        outputs.push(outAsset);
      }
      execCtx.onProgress?.(1, 'Done');
      return outputs;
    },
  };
}

/** 从原 Asset 与输出 Blob 派生新 Asset 的元数据 */
function deriveOutputMetadata(
  source: Asset,
  outBlob: Blob
): import('@lokvis/schema').AssetMetadata {
  const mimeType = outBlob.type || source.metadata.mimeType;
  const format = mimeType.split('/')[1] ?? source.metadata.format;
  return {
    mimeType,
    size: outBlob.size,
    format,
    dimensions: source.metadata.dimensions,
  };
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

// engine-video 暂未提供以下三个方法，这里直接抛错，
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

/**
 * 构造所有视频能力的 CapabilityImplementation
 * （由 plugin.ts 在 installer 中调用）
 */
export function buildVideoCapabilityImplementations(
  ctx: PluginContext
): CapabilityImplementation[] {
  return VIDEO_CAPABILITY_ENTRIES.map((entry) => wrapAsImplementation(entry, ctx));
}
