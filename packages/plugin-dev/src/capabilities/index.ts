/**
 * 开发者工具能力(聚合入口)
 *
 * 各能力实现独立成文件,此处提供统一构造函数。
 * 由 plugin.ts 在 installer 中调用。
 */
import type { CapabilityImplementation, PluginContext } from '@lokvis/schema';
import { createInspectCapabilitiesImpl } from './inspect-capabilities.js';
import { createInspectAssetImpl } from './inspect-asset.js';
import { createValidateWorkflowImpl } from './validate-workflow.js';
import { createProfileImpl } from './profile.js';

/**
 * 构造所有开发者工具能力的 CapabilityImplementation
 * （由 plugin.ts 在 installer 中调用)
 */
export function buildDevCapabilityImplementations(
  ctx: PluginContext
): CapabilityImplementation[] {
  return [
    createInspectCapabilitiesImpl(ctx),
    createInspectAssetImpl(ctx),
    createValidateWorkflowImpl(ctx),
    createProfileImpl(ctx),
  ];
}

export { createInspectCapabilitiesImpl } from './inspect-capabilities.js';
export { createInspectAssetImpl } from './inspect-asset.js';
export { createValidateWorkflowImpl } from './validate-workflow.js';
export { createProfileImpl } from './profile.js';
