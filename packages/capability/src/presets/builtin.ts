/**
 * 内置能力聚合
 *
 * 将各域能力数组合并为单一 BUILTIN_CAPABILITIES,供 Runtime/SDK 注册默认能力。
 */
import type { Capability } from '@lokvis/schema';
import { IMAGE_CAPABILITIES } from './image.generated.js';
import { PDF_CAPABILITIES } from './pdf.generated.js';
import { VIDEO_CAPABILITIES } from './video.generated.js';
import { AUDIO_CAPABILITIES } from './audio.generated.js';
import { AI_CAPABILITIES } from './ai.generated.js';
import { ASSET_CAPABILITIES } from './asset.js';
import { DEV_CAPABILITIES } from './developer.generated.js';

/** 所有内置能力预设(按域顺序聚合) */
export const BUILTIN_CAPABILITIES: Capability[] = [
  ...IMAGE_CAPABILITIES,
  ...PDF_CAPABILITIES,
  ...VIDEO_CAPABILITIES,
  ...AUDIO_CAPABILITIES,
  ...AI_CAPABILITIES,
  ...ASSET_CAPABILITIES,
  ...DEV_CAPABILITIES,
];
