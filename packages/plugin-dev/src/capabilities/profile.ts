/**
 * developer.profile —— 能力执行耗时剖析(支持批量)
 *
 * 对每个输入资产执行 iterations 次 noop(仅读取 Blob 以测量 I/O 与框架开销),
 * 汇总耗时统计:total/avg/min/max。
 */
import type { CapabilityImplementation, PluginContext } from '@lokvis/schema';
import { createCapabilityImpl } from '@lokvis/plugin-sdk';
import { createJsonAsset, INLINE_ENGINE } from './shared.js';

/** 创建 developer.profile 能力实现 */
export function createProfileImpl(
  ctx: PluginContext
): CapabilityImplementation {
  return createCapabilityImpl(
    'developer.profile',
    INLINE_ENGINE,
    async (inputs, params, execCtx) => {
      const iterations =
        typeof params.iterations === 'number' && params.iterations > 0
          ? Math.floor(params.iterations)
          : 1;
      const timings: number[] = [];

      // 使用 entries() 解构，避免 noUncheckedIndexedAccess 下 inputs[i] 被推断为 Asset | undefined
      for (const [i, asset] of inputs.entries()) {
        if (execCtx.signal.aborted) {
          throw new DOMException('Aborted', 'AbortError');
        }
        for (let n = 0; n < iterations; n++) {
          const start = performance.now();
          // noop：仅读取输入 Blob，不做实际变换，用于测量框架与 I/O 开销
          await ctx.runtime.getAssetBlob(asset);
          timings.push(performance.now() - start);
        }
        execCtx.onProgress?.(
          (i + 1) / inputs.length,
          `Profiled ${i + 1}/${inputs.length}`
        );
      }

      const totalTime = timings.reduce((a, b) => a + b, 0);
      execCtx.onProgress?.(1, 'Profiling complete');
      return [
        await createJsonAsset(ctx, {
          iterations,
          inputCount: inputs.length,
          totalRuns: timings.length,
          totalTime,
          avgTime: timings.length ? totalTime / timings.length : 0,
          minTime: timings.length ? Math.min(...timings) : 0,
          maxTime: timings.length ? Math.max(...timings) : 0,
        }),
      ];
    }
  );
}
