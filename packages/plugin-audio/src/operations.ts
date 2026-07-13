/**
 * Audio Capability 实现
 *
 * 通过 plugin-sdk 的 createBlobCapabilityImpl / createMergeCapabilityImpl 工厂
 * 把 engine-audio 的 Blob↔Blob 操作包装为 CapabilityImplementation:
 *   Asset[] + params → Asset[]
 *
 * 三种 single(1→1)能力走 createBlobCapabilityImpl:
 * - audio.trim       → webAudioEngine.trim
 * - audio.normalize  → webAudioEngine.normalize
 * - audio.transcode  → lamejsEngine.transcode
 *
 * 一种 merge(N→1)能力走 createMergeCapabilityImpl:
 * - audio.merge      → webAudioEngine.merge
 *
 * 注意:engine-audio 当前为占位实现,所有方法均抛出 "not implemented in stub",
 * 因此 plugin-audio 的各操作在运行时也会抛出 —— 这是有意为之的 stub 行为。
 *
 * 能力声明(AUDIO_CAPABILITIES)由 codegen 从 manifests/audio.manifest.json 生成,
 * 见 packages/capability/src/presets/audio.generated.ts。本文件只负责 impl 绑定
 * (capability name → engine + kind + outputType + operation + isStub)。
 */

import {
  createBlobCapabilityImpl,
  createMergeCapabilityImpl,
} from '@lokvis/plugin-sdk';
import { webAudioEngine, lamejsEngine } from '@lokvis/engine-audio';
import type {
  AssetMetadata,
  AssetType,
  CapabilityImplementation,
  PluginContext,
} from '@lokvis/schema';

/** 音频操作形态:single(1→1) / merge(N→1) */
export type AudioOperationKind = 'single' | 'merge';

/** 单输入 → 单输出操作(trim / normalize / transcode) */
export type SingleAudioOperation = (
  blob: Blob,
  params: Record<string, unknown>
) => Promise<Blob>;

/** 多输入 → 单输出操作(merge) */
export type MergeAudioOperation = (
  blobs: Blob[],
  params: Record<string, unknown>
) => Promise<Blob>;

/** 音频能力实现绑定项 */
export interface AudioOperationEntry {
  /** 对应 Capability 名(与 generated 声明的 name 字段关联) */
  capability: string;
  /** 引擎名 */
  engine: string;
  /** 操作形态:single(1→1) / merge(N→1) */
  kind: AudioOperationKind;
  /** 输出 Asset 类型 */
  outputType: AssetType;
  /** 实际执行函数 */
  operation: SingleAudioOperation | MergeAudioOperation;
  /** 是否为 stub 实现(engine.version.includes('stub')) */
  isStub: boolean;
}

// ─── 各操作的参数转换 + 调用 ───────────────────────────────
// engine-audio 操作函数已接受 Record<string, any>,无需类型断言。
// 注意:webAudioEngine.merge 签名是 (blobs: Blob[]) → 不接受 params,
// 用包装层丢弃 params 保持 MergeAudioOperation 签名一致。

const trimOp: SingleAudioOperation = (blob, params) =>
  webAudioEngine.trim(blob, params);

const normalizeOp: SingleAudioOperation = (blob, params) =>
  webAudioEngine.normalize(blob, params);

const transcodeOp: SingleAudioOperation = (blob, params) =>
  lamejsEngine.transcode(blob, params);

const mergeOp: MergeAudioOperation = (blobs) => webAudioEngine.merge(blobs);

/** 各引擎 stub 标识(AGENTS.md 约定:version.includes('stub')) */
const webAudioIsStub = webAudioEngine.version.includes('stub');
const lamejsIsStub = lamejsEngine.version.includes('stub');

/** 全部音频能力实现绑定(operation → engine + kind + outputType + isStub 映射,能力声明由 generated 提供) */
export const AUDIO_OPERATION_ENTRIES: AudioOperationEntry[] = [
  { capability: 'audio.trim',      engine: 'web-audio', kind: 'single', outputType: 'audio', operation: trimOp,      isStub: webAudioIsStub },
  { capability: 'audio.normalize', engine: 'web-audio', kind: 'single', outputType: 'audio', operation: normalizeOp, isStub: webAudioIsStub },
  { capability: 'audio.merge',     engine: 'web-audio', kind: 'merge',  outputType: 'audio', operation: mergeOp,     isStub: webAudioIsStub },
  { capability: 'audio.transcode', engine: 'lamejs',    kind: 'single', outputType: 'audio', operation: transcodeOp, isStub: lamejsIsStub },
];

/** 从输出 Blob 派生新 Asset 的元数据(merge 无单一 source) */
function deriveAudioMetadata(outBlob: Blob): AssetMetadata {
  const mimeType = outBlob.type || 'audio/mpeg';
  const format = mimeType.split('/')[1] ?? 'mp3';
  return { mimeType, size: outBlob.size, format };
}

/**
 * 构造所有音频能力的 CapabilityImplementation
 * (由 plugin.ts 在 installer 中调用)
 *
 * stub 标识已在 AUDIO_OPERATION_ENTRIES 中按引擎一次性计算,
 * 不再在此处重复检测 engine.version。
 */
export function buildAudioCapabilityImplementations(
  ctx: PluginContext
): CapabilityImplementation[] {
  return AUDIO_OPERATION_ENTRIES.map((entry) => {
    switch (entry.kind) {
      case 'merge':
        return createMergeCapabilityImpl(
          {
            capability: entry.capability,
            engine: entry.engine,
            outputType: entry.outputType,
            operation: entry.operation as MergeAudioOperation,
            isStub: entry.isStub,
            deriveMetadata: deriveAudioMetadata,
          },
          ctx
        );
      case 'single':
        return createBlobCapabilityImpl(
          {
            capability: entry.capability,
            engine: entry.engine,
            outputType: entry.outputType,
            operation: entry.operation as SingleAudioOperation,
            isStub: entry.isStub,
            // 音频变换不传播 dimensions,丢弃 source 只取 outBlob
            deriveMetadata: (_source, outBlob) => deriveAudioMetadata(outBlob),
          },
          ctx
        );
    }
  });
}
