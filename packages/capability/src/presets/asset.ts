/**
 * Asset 通用能力预设
 *
 * 跨类型资产的通用操作:rename。与具体媒体类型解耦。
 *
 * 注意:旧 `asset.archive` 已弃用并迁移至独立 `archive.*` 域
 * (archive.zip / archive.unzip / archive.list,由 engine-archive + plugin-archive
 * 真实现,见 docs/adr/ADR-017-archive-domain.md)。
 */
import type { Capability } from '@lokvis/schema';

export const ASSET_RENAME: Capability = {
  name: 'asset.rename',
  description: 'Rename asset using a pattern',
  inputTypes: ['image', 'video', 'audio', 'pdf', 'text', 'data'],
  outputTypes: ['image', 'video', 'audio', 'pdf', 'text', 'data'],
  params: [
    {
      name: 'pattern',
      type: 'string',
      required: true,
      description: 'Pattern: {name} {index} {date} {width} {height}',
    },
  ],
  performance: 'fast',
  batchable: true,
};

/** 所有内置 Asset 通用能力预设 */
export const ASSET_CAPABILITIES: Capability[] = [ASSET_RENAME];
