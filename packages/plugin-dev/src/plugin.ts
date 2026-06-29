/**
 * Developer Tools Plugin 定义
 *
 * 提供面向 Plugin 开发者的工具能力：
 * - developer.inspect.capabilities：列出所有已注册能力
 * - developer.inspect.asset：检视资产元数据与结构
 * - developer.validate.workflow：校验 Workflow 定义（不执行）
 * - developer.profile：能力执行耗时剖析
 *
 * 该插件不依赖任何外部 Engine，所有能力在 Plugin 内直接实现，
 * 因此 PluginConfig 中省略 engine 字段，能力实现使用 'builtin' 作为前哨 engine 名。
 */

import { definePlugin, createCapabilityImpl } from '@lokvis/plugin-sdk';
import { DEVELOPER_CAPABILITIES } from '@lokvis/capability';
import type {
  Asset,
  AssetMetadata,
  PluginContext,
  Workflow,
} from '@lokvis/schema';

export const PLUGIN_NAME = 'lokvis-dev-tools';
export const PLUGIN_VERSION = '0.1.0';

/**
 * 内联实现使用的前哨 engine 名。
 * CapabilityImplementation 类型要求填写 engine 字段，
 * 但本插件无外部引擎依赖，统一用 'builtin' 表示在 Plugin 内直接实现。
 */
const INLINE_ENGINE = 'builtin';

/**
 * 把任意可 JSON 序列化的值封装为 data 类型的 Asset。
 * 所有开发者工具能力的输出都是 JSON 文本，统一走此工具函数。
 */
function createJsonAsset(
  ctx: PluginContext,
  value: unknown
): Promise<Asset> {
  const json = JSON.stringify(value, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const metadata: AssetMetadata = {
    mimeType: 'application/json',
    size: blob.size,
    format: 'json',
  };
  return ctx.runtime.createAsset(blob, metadata, 'data');
}

/**
 * 创建开发者工具插件
 *
 * @example
 * ```ts
 * import { createLokvis } from '@lokvis/sdk';
 * import { devToolsPlugin } from '@lokvis/plugin-dev';
 *
 * const lokvis = await createLokvis({
 *   plugins: [devToolsPlugin()],
 * });
 * ```
 */
export function devToolsPlugin() {
  return definePlugin(
    {
      name: PLUGIN_NAME,
      version: PLUGIN_VERSION,
      description:
        'Developer tools: capability introspection / asset inspection / workflow validation / performance profiling',
      capabilities: DEVELOPER_CAPABILITIES,
      permissions: ['asset:read', 'asset:write', 'network:none'],
    },
    (ctx) => {
      // developer.inspect.capabilities：列出所有已注册能力
      ctx.registerCapability(
        createCapabilityImpl(
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
        )
      );

      // developer.inspect.asset：检视资产元数据与结构（支持批量）
      ctx.registerCapability(
        createCapabilityImpl(
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
        )
      );

      // developer.validate.workflow：校验 Workflow 定义（不执行）
      // Workflow 通过 params.workflow 传入
      ctx.registerCapability(
        createCapabilityImpl(
          'developer.validate.workflow',
          INLINE_ENGINE,
          async (_inputs, params, execCtx) => {
            const workflow = params.workflow as Workflow | undefined;
            const errors: string[] = [];

            if (!workflow || typeof workflow !== 'object') {
              errors.push('Missing "workflow" parameter');
            } else {
              if (!workflow.id) errors.push('Workflow "id" is required');
              if (!workflow.name) errors.push('Workflow "name" is required');

              // 节点校验：必须为数组且至少一个节点，每个节点需有 id 与 capability
              const nodes = Array.isArray(workflow.nodes) ? workflow.nodes : [];
              const edges = Array.isArray(workflow.edges) ? workflow.edges : [];

              if (nodes.length === 0) {
                errors.push('Workflow must contain at least one node');
              }
              for (const node of nodes) {
                if (!node.id) errors.push('Node missing "id"');
                if (!node.capability) {
                  errors.push(`Node "${node.id || '?'}" missing "capability"`);
                }
              }

              // 边校验：from / to 必须引用已存在的节点
              const nodeIds = new Set(nodes.map((n) => n.id));
              for (const edge of edges) {
                if (!nodeIds.has(edge.from)) {
                  errors.push(`Edge references unknown "from" node: ${edge.from}`);
                }
                if (!nodeIds.has(edge.to)) {
                  errors.push(`Edge references unknown "to" node: ${edge.to}`);
                }
              }
            }

            execCtx.onProgress?.(1, 'Validation complete');
            return [
              await createJsonAsset(ctx, {
                valid: errors.length === 0,
                errors,
                nodeCount: Array.isArray(workflow?.nodes) ? workflow.nodes.length : 0,
                edgeCount: Array.isArray(workflow?.edges) ? workflow.edges.length : 0,
              }),
            ];
          }
        )
      );

      // developer.profile：能力执行耗时剖析（支持批量）
      // 对每个输入资产执行 iterations 次 noop（仅读取 Blob 以测量 I/O 与框架开销），汇总耗时统计
      ctx.registerCapability(
        createCapabilityImpl(
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
        )
      );

      ctx.log('info', `Registered ${DEVELOPER_CAPABILITIES.length} developer capabilities`);
    }
  );
}
