/**
 * Asset 通用能力预设
 *
 * 跨类型资产的通用操作:rename / archive。与具体媒体类型解耦。
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

export const ASSET_ARCHIVE: Capability = {
  name: 'asset.archive',
  description: 'Pack multiple assets into a zip archive',
  inputTypes: ['image', 'video', 'audio', 'pdf', 'text', 'data'],
  outputTypes: ['data'],
  params: [{ name: 'format', type: 'enum', values: ['zip'], default: 'zip' }],
  performance: 'medium',
  batchable: false,
};

/** 所有内置 Asset 通用能力预设 */
export const ASSET_CAPABILITIES: Capability[] = [ASSET_RENAME, ASSET_ARCHIVE];
