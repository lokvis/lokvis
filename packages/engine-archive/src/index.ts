/**
 * @lokvis/engine-archive
 *
 * Archive Engine 层 — Blob↔Blob 纯函数操作(zip / unzip / list)。
 *
 * 设计说明:
 * - 基于 fflate:纯 JS 零 WASM,浏览器/Node 同构,无需 `./node` 子路径
 * - 是真实实现而非 stub —— ARCHIVE_ENGINE.version 不含 'stub',
 *   plugin-archive 据此推导 isStub=false
 * - AGENTS.md:Engine 层只暴露 Blob↔Blob 纯函数,不感知 Asset/Workflow
 * - 大文件内存守卫由 Runtime 批处理层负责(Engine 不能 import L4 的 MemoryGuard)
 *
 * 见 docs/adr/ADR-017-archive-domain.md(能力面与选型裁决)。
 */

export { zipBlobs, unzipBlob, listArchive } from './operations.js';

import type { ArchiveEngineDescriptor } from './types.js';

/**
 * 归档引擎描述符 — 真实现(fflate)。
 *
 * version 不含 'stub',plugin-archive 据此推导 isStub=false。
 */
export const ARCHIVE_ENGINE: ArchiveEngineDescriptor = {
  name: 'fflate',
  version: '0.9.0',
};

export type {
  ArchiveEngineDescriptor,
  ArchiveZipParams,
  ArchiveUnzipParams,
  ArchiveListParams,
  ArchiveEntry,
} from './types.js';
