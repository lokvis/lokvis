/**
 * developer.inspect.capabilities —— 列出所有已注册能力
 */
import type { CapabilityImplementation, PluginContext } from '@lokvis/schema';
import { createCapabilityImpl } from '@lokvis/plugin-sdk';
import { createJsonAsset, INLINE_ENGINE } from './shared.js';

/** 创建 developer.inspect.capabilities 能力实现 */
export function createInspectCapabilitiesImpl(
  ctx: PluginContext
): CapabilityImplementation {
  return createCapabilityImpl(
    'developer.inspect.capabilities',
    INLINE_ENGINE,
    async (_inputs, _params, execCtx) => {
      const capabilities = await ctx.runtime.listCapabilities();
      execCtx.onProgress?.(1, `Listed ${capabilities.length} capabilities`);
      return [
        await createJsonAsset(ctx, {
          count: capabilities.length,
          capabilities,
        }),
      ];
    }
  );
}
