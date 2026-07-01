/**
 * developer.inspect.asset —— 检视资产元数据与结构(支持批量)
 *
 * verbose 模式附带标签、历史条数与时间戳;精简模式只返回 id/type/metadata。
 */
import type { Asset, CapabilityImplementation, PluginContext } from '@lokvis/schema';
import { createCapabilityImpl } from '@lokvis/plugin-sdk';
import { createJsonAsset, INLINE_ENGINE } from './shared.js';

/** 创建 developer.inspect.asset 能力实现 */
export function createInspectAssetImpl(
  ctx: PluginContext
): CapabilityImplementation {
  return createCapabilityImpl(
    'developer.inspect.asset',
    INLINE_ENGINE,
    async (inputs, params, execCtx) => {
      const verbose = params.verbose === true;
      const outputs: Asset[] = [];
      // 使用 entries() 解构，避免 noUncheckedIndexedAccess 下 inputs[i] 被推断为 Asset | undefined
      for (const [i, asset] of inputs.entries()) {
        if (execCtx.signal.aborted) {
          throw new DOMException('Aborted', 'AbortError');
        }
        execCtx.onProgress?.(
          i / inputs.length,
          `Inspecting ${i + 1}/${inputs.length}`
        );
        // verbose 模式附带标签、历史条数与时间戳；精简模式只返回 id/type/metadata
        const info = verbose
          ? {
              id: asset.id,
              type: asset.type,
              metadata: asset.metadata,
              tags: asset.tags,
              historyCount: asset.history.length,
              createdAt: asset.createdAt,
              updatedAt: asset.updatedAt,
            }
          : {
              id: asset.id,
              type: asset.type,
              metadata: asset.metadata,
            };
        outputs.push(await createJsonAsset(ctx, info));
      }
      execCtx.onProgress?.(1, 'Done');
      return outputs;
    }
  );
}
