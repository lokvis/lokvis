/**
 * Audio Capability 实现(浏览器版,全 stub)
 *
 * 与 plugin-video/src/operations.ts 模式对齐:
 * - 通过 plugin-sdk 的 createBlobCapabilityImpl / createMergeCapabilityImpl 工厂
 *   把 engine-audio 的 Blob↔Blob 操作包装为 CapabilityImplementation
 * - 浏览器版所有操作标记为 stub(engine-audio 浏览器端不加载 ffmpeg.wasm)
 * - 真实 Node 端操作由 `@lokvis/plugin-audio/node` 提供,经子路径导出
 *
 * 两种形态:
 * - single(1→1):trim / normalize / transcode
 * - merge(N→1):audio.merge
 *
 * 能力声明(AUDIO_CAPABILITIES)由 codegen 从 manifests/audio.manifest.json 生成,
 * 见 packages/capability/src/presets/audio.generated.ts。本文件只负责 impl 绑定
 * (capability name → engine + operation + outputType)。
 *
 * AGENTS.md Stub Engine 约定:
 * - 所有 operation 方法抛出 `new Error('xxx not implemented in stub')`
 * - isStub=true 让 CapabilityRegistry.resolve() 自动跳过
 *
 * 与旧版 AudioEngineAdapter 接口的差异:
 * - 旧版用 kind 字段分发,新版与 plugin-video 一致:1→1 走 entries,
 *   N→1(merge)单独走 MERGE_OPERATION,无需 kind 字段
 */

import {
  createBlobCapabilityImpl,
  createMergeCapabilityImpl,
} from '@lokvis/plugin-sdk';
import type {
  AssetMetadata,
  AssetType,
  CapabilityImplementation,
  PluginContext,
} from '@lokvis/schema';
import {
  trimAudio,
  normalizeAudio,
  transcodeAudio,
  mergeAudios,
} from '@lokvis/engine-audio';

/** 单输入 → 单输出操作(1→1) */
export type AudioOperation = (
  blob: Blob,
  params: Record<string, unknown>
) => Promise<Blob>;

/** 多输入 → 单输出操作(N→1,merge) */
export type MergeAudioOperation = (
  blobs: Blob[],
  params: Record<string, unknown>
) => Promise<Blob>;

/** 音频能力实现绑定项(capability name → engine + operation + outputType) */
export interface AudioOperationEntry {
  /** 对应 Capability 名(与 generated 声明的 name 字段关联) */
  capability: string;
  /** 引擎名 */
  engine: string;
  /** 输出 Asset 类型 */
  outputType: AssetType;
  /** 实际执行函数(浏览器版永远抛 stub 错误) */
  operation: AudioOperation;
}

/** 浏览器版引擎名(与 PLUGIN_ENGINE 对齐;概念上对应 ffmpeg.wasm,虽浏览器端不加载) */
const BROWSER_ENGINE = 'ffmpeg-wasm' as const;

/** 1→1 能力实现绑定(merge 单独走 createMergeCapabilityImpl) */
export const AUDIO_OPERATION_ENTRIES: AudioOperationEntry[] = [
  { capability: 'audio.trim',      engine: BROWSER_ENGINE, outputType: 'audio', operation: trimAudio },
  { capability: 'audio.normalize', engine: BROWSER_ENGINE, outputType: 'audio', operation: normalizeAudio },
  { capability: 'audio.transcode', engine: BROWSER_ENGINE, outputType: 'audio', operation: transcodeAudio },
];

/** merge 操作(单独管理,因形态为 N→1) */
export const MERGE_OPERATION: {
  capability: string;
  engine: string;
  outputType: AssetType;
  operation: MergeAudioOperation;
} = {
  capability: 'audio.merge',
  engine: BROWSER_ENGINE,
  outputType: 'audio',
  operation: mergeAudios,
};

/** 浏览器版所有操作为 stub(engine-audio 浏览器端不加载 ffmpeg.wasm) */
const isStub = true;

/** 从输出 Blob 派生 audio 类型 Asset 元数据 */
function deriveAudioMetadata(outBlob: Blob): AssetMetadata {
  const fallback = { mimeType: 'audio/mpeg', format: 'mp3' };
  const mimeType = outBlob.type || fallback.mimeType;
  const format = mimeType.split('/')[1] ?? fallback.format;
  return { mimeType, size: outBlob.size, format };
}

/**
 * 构造所有音频能力的 CapabilityImplementation(浏览器版,全 stub)
 *
 * 由 plugin.ts 在 installer 中调用。AGENTS.md Stub Engine 约定:
 * isStub=true 让 CapabilityRegistry.resolve() 自动跳过本实现,
 * executor 在 stub-only 时给出明确错误提示。
 */
export function buildAudioCapabilityImplementations(
  ctx: PluginContext
): CapabilityImplementation[] {
  const singleImpls = AUDIO_OPERATION_ENTRIES.map((entry) => {
    return createBlobCapabilityImpl(
      {
        capability: entry.capability,
        engine: entry.engine,
        outputType: entry.outputType,
        operation: entry.operation,
        isStub,
        deriveMetadata: (_source, outBlob) => deriveAudioMetadata(outBlob),
      },
      ctx
    );
  });

  const mergeImpl = createMergeCapabilityImpl(
    {
      capability: MERGE_OPERATION.capability,
      engine: MERGE_OPERATION.engine,
      outputType: MERGE_OPERATION.outputType,
      operation: MERGE_OPERATION.operation,
      isStub,
      deriveMetadata: deriveAudioMetadata,
    },
    ctx
  );

  return [...singleImpls, mergeImpl];
}
