/**
 * Video Capability 实现(浏览器版,全 stub)
 *
 * 与 plugin-pdf/src/operations.ts 模式对齐:
 * - 通过 plugin-sdk 的 createBlobCapabilityImpl / createMergeCapabilityImpl 工厂
 *   把 engine-video 的 Blob↔Blob 操作包装为 CapabilityImplementation
 * - 浏览器版所有操作标记为 stub(engine-video 浏览器端不加载 ffmpeg.wasm)
 * - 真实 Node 端操作由 `@lokvis/plugin-video/node` 提供,经子路径导出
 *
 * 两种形态:
 * - single(1→1):compress / transcode / trim / extract-audio / to-gif / screenshot
 * - merge(N→1):video.merge
 *
 * 能力声明(VIDEO_CAPABILITIES)由 codegen 从 manifests/video.manifest.json 生成,
 * 见 packages/capability/src/presets/video.generated.ts。本文件只负责 impl 绑定
 * (capability name → engine + kind + outputType + operation)。
 *
 * AGENTS.md Stub Engine 约定:
 * - 所有 operation 方法抛出 `new Error('xxx not implemented in stub')`
 * - isStub=true 让 CapabilityRegistry.resolve() 自动跳过
 */

import {
  createBlobCapabilityImpl,
  createMergeCapabilityImpl,
} from '@lokvis/plugin-sdk';
import type {
  AssetMetadata,
  AssetType,
  BuiltinCapabilityName,
  CapabilityImplementation,
  PluginContext,
} from '@lokvis/schema';
import {
  compressVideo,
  transcodeVideo,
  trimVideo,
  mergeVideos,
  extractAudio,
  toGif,
  screenshotVideo,
  VIDEO_ENGINE,
} from '@lokvis/engine-video';

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

/** 视频能力实现绑定项(capability name → engine + operation + outputType) */
export interface VideoOperationEntry {
  /** 对应 Capability 名(与 generated 声明的 name 字段关联) */
  capability: BuiltinCapabilityName;
  /** 引擎名 */
  engine: string;
  /** 输出 Asset 类型 */
  outputType: AssetType;
  /** 实际执行函数(浏览器版永远抛 stub 错误) */
  operation: VideoOperation;
}

/** 浏览器版引擎名(单一来源:engine-video 默认入口的 VIDEO_ENGINE 描述符) */
const BROWSER_ENGINE = VIDEO_ENGINE.name;

/** 1→1 能力实现绑定(merge 单独走 createMergeCapabilityImpl) */
export const VIDEO_OPERATION_ENTRIES: VideoOperationEntry[] = [
  { capability: 'video.compress',      engine: BROWSER_ENGINE, outputType: 'video', operation: compressVideo },
  { capability: 'video.transcode',     engine: BROWSER_ENGINE, outputType: 'video', operation: transcodeVideo },
  { capability: 'video.trim',          engine: BROWSER_ENGINE, outputType: 'video', operation: trimVideo },
  { capability: 'video.extract-audio', engine: BROWSER_ENGINE, outputType: 'audio', operation: extractAudio },
  { capability: 'video.to-gif',        engine: BROWSER_ENGINE, outputType: 'image', operation: toGif },
  { capability: 'video.screenshot',    engine: BROWSER_ENGINE, outputType: 'image', operation: screenshotVideo },
];

/** merge 操作(单独管理,因形态为 N→1) */
export const MERGE_OPERATION: {
  capability: BuiltinCapabilityName;
  engine: string;
  outputType: AssetType;
  operation: MergeVideoOperation;
} = {
  capability: 'video.merge',
  engine: BROWSER_ENGINE,
  outputType: 'video',
  operation: mergeVideos,
};

/** 浏览器版 stub 状态单点推导(AGENTS.md 约定:version 含 'stub') */
const isStub = VIDEO_ENGINE.version.includes('stub');

/** 从输出 Blob 派生 video/audio/image 类型 Asset 元数据 */
export function deriveVideoMetadata(outputType: AssetType): (outBlob: Blob) => AssetMetadata {
  return (outBlob: Blob) => {
    let fallback: { mimeType: string; format: string };
    switch (outputType) {
      case 'video':
        fallback = { mimeType: 'video/mp4', format: 'mp4' };
        break;
      case 'audio':
        fallback = { mimeType: 'audio/mpeg', format: 'mp3' };
        break;
      case 'image':
        fallback = { mimeType: 'image/png', format: 'png' };
        break;
      default:
        fallback = { mimeType: 'application/octet-stream', format: 'bin' };
    }
    const mimeType = outBlob.type || fallback.mimeType;
    const format = mimeType.split('/')[1] ?? fallback.format;
    return { mimeType, size: outBlob.size, format };
  };
}

/**
 * 构造所有视频能力的 CapabilityImplementation(浏览器版,全 stub)
 *
 * 由 plugin.ts 在 installer 中调用。AGENTS.md Stub Engine 约定:
 * isStub=true 让 CapabilityRegistry.resolve() 自动跳过本实现,
 * executor 在 stub-only 时给出明确错误提示。
 */
export function buildVideoCapabilityImplementations(
  ctx: PluginContext
): CapabilityImplementation[] {
  const singleImpls = VIDEO_OPERATION_ENTRIES.map((entry) => {
    const derive = deriveVideoMetadata(entry.outputType);
    return createBlobCapabilityImpl(
      {
        capability: entry.capability,
        engine: entry.engine,
        outputType: entry.outputType,
        operation: entry.operation,
        isStub,
        deriveMetadata: (_source, outBlob) => derive(outBlob),
      },
      ctx
    );
  });

  const mergeDerive = deriveVideoMetadata(MERGE_OPERATION.outputType);
  const mergeImpl = createMergeCapabilityImpl(
    {
      capability: MERGE_OPERATION.capability,
      engine: MERGE_OPERATION.engine,
      outputType: MERGE_OPERATION.outputType,
      operation: MERGE_OPERATION.operation,
      isStub,
      deriveMetadata: mergeDerive,
    },
    ctx
  );

  return [...singleImpls, mergeImpl];
}
