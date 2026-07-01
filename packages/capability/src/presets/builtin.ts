/**
 * 内置能力聚合
 *
 * 将各域能力数组合并为单一 BUILTIN_CAPABILITIES,供 Runtime/SDK 注册默认能力。
 */
import type { Capability } from '@lokvis/schema';
import { IMAGE_CAPABILITIES } from './image.js';
import { PDF_CAPABILITIES } from './pdf.js';
import { VIDEO_CAPABILITIES } from './video.js';
import { ASSET_CAPABILITIES } from './asset.js';
import { DEVELOPER_CAPABILITIES } from './developer.js';

/** 所有内置能力预设(按域顺序聚合) */
export const BUILTIN_CAPABILITIES: Capability[] = [
  ...IMAGE_CAPABILITIES,
  ...PDF_CAPABILITIES,
  ...VIDEO_CAPABILITIES,
  ...ASSET_CAPABILITIES,
  ...DEVELOPER_CAPABILITIES,
];
