/**
 * Archive Capability 实现(真实现,非 stub)
 *
 * 与 plugin-pdf/src/operations.ts 模式对齐,通过 plugin-sdk 三个工厂把
 * engine-archive 的 Blob↔Blob 操作包装为 CapabilityImplementation:
 * - single(1→1):archive.list → createBlobCapabilityImpl(输出 application/json data Asset)
 * - merge(N→1):archive.zip → createMergeCapabilityImpl
 * - split(1→N):archive.unzip → createSplitCapabilityImpl
 *
 * 与 plugin-audio/plugin-pdf 的关键差异:engine-archive 基于 fflate 同构真实现,
 * ARCHIVE_ENGINE.version 不含 'stub',故 isStub=false,status='stable'(不被 resolve 跳过)。
 *
 * 能力声明(ARCHIVE_CAPABILITIES)由 codegen 从 manifests/archive.manifest.json 生成,
 * 见 packages/capability/src/presets/archive.generated.ts。本文件只负责 impl 绑定。
 */

import {
  createBlobCapabilityImpl,
  createMergeCapabilityImpl,
  createSplitCapabilityImpl,
} from '@lokvis/plugin-sdk';
import type {
  AssetMetadata,
  CapabilityImplementation,
  PluginContext,
} from '@lokvis/schema';
import {
  zipBlobs,
  unzipBlob,
  listArchive,
  ARCHIVE_ENGINE,
} from '@lokvis/engine-archive';

/** 引擎名(单一来源:engine-archive 的 ARCHIVE_ENGINE 描述符) */
const ENGINE = ARCHIVE_ENGINE.name;

/** stub 状态单点推导(AGENTS.md 约定:version 含 'stub';archive 为真实现故为 false) */
const isStub = ARCHIVE_ENGINE.version.includes('stub');

/** 从输出 Blob 派生 data 类型 Asset 元数据(archive 输出统一为 data 类型) */
function deriveDataMetadata(outBlob: Blob): AssetMetadata {
  const mimeType = outBlob.type || 'application/octet-stream';
  const format = mimeType.split('/')[1] ?? 'bin';
  return { mimeType, size: outBlob.size, format };
}

/**
 * 构造所有 archive 能力的 CapabilityImplementation(真实现)。
 *
 * 由 plugin.ts 在 installer 中调用。isStub=false,status='stable',
 * CapabilityRegistry.resolve() 正常选用。
 */
export function buildArchiveCapabilityImplementations(
  ctx: PluginContext
): CapabilityImplementation[] {
  const zipImpl = createMergeCapabilityImpl(
    {
      capability: 'archive.zip',
      engine: ENGINE,
      outputType: 'data',
      operation: zipBlobs,
      isStub,
      deriveMetadata: deriveDataMetadata,
    },
    ctx
  );

  const unzipImpl = createSplitCapabilityImpl(
    {
      capability: 'archive.unzip',
      engine: ENGINE,
      outputType: 'data',
      operation: unzipBlob,
      isStub,
      deriveMetadata: deriveDataMetadata,
    },
    ctx
  );

  const listImpl = createBlobCapabilityImpl(
    {
      capability: 'archive.list',
      engine: ENGINE,
      outputType: 'data',
      operation: listArchive,
      isStub,
      deriveMetadata: (_source, outBlob) => deriveDataMetadata(outBlob),
    },
    ctx
  );

  return [zipImpl, unzipImpl, listImpl];
}
