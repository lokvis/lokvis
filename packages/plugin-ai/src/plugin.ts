/**
 * AI Tools Plugin 定义(F1)
 *
 * 通过 definePlugin 注册 6 个 AI 能力声明,
 * installer 阶段把每个能力映射到 engine-ai 的实现。
 *
 * 三引擎(逻辑):
 * - transformersEngine(本地,Phase 4 前为 stub):ocr / caption / background-remove
 * - cloudProxyEngine(云端,F1 实装):generate-workflow / optimize-workflow / diagnose-error
 *   - 有 cloudCaller 注入 → 走真实 cloud-bridge CloudAiClient
 *   - 无 cloudCaller 注入 → 走 stub(浏览器/无 API Key 场景)
 *
 * F1 变更:
 * - aiToolsPlugin 接受可选 { cloudCaller } 参数
 * - 新增 ai.diagnose-error 能力(由 buildAiCapabilityImplementations 桥接)
 */

import { definePlugin } from '@lokvis/plugin-sdk';
import { AI_CAPABILITIES } from '@lokvis/capability';
import type { AiCloudCaller } from '@lokvis/engine-ai';
import { buildAiCapabilityImplementations } from './operations.js';

export const PLUGIN_NAME = 'lokvis-ai-tools';
export const PLUGIN_VERSION = '0.2.0';

/**
 * 创建 AI 工具插件
 *
 * @param options 可选配置
 *   - cloudCaller:cloud-proxy 调用器(由 @lokvis/cloud-bridge 的 CloudAiClient
 *     实现)。注入后,3 个 cloud-proxy 能力(generate-workflow /
 *     optimize-workflow / diagnose-error)走真实 cloud 调用;
 *     未注入时走 stub 路径。
 *
 * @example 浏览器场景(无 cloud)
 * ```ts
 * import { createLokvis } from '@lokvis/sdk';
 * import { aiToolsPlugin } from '@lokvis/plugin-ai';
 *
 * const lokvis = await createLokvis({
 *   plugins: [aiToolsPlugin()],
 * });
 * ```
 *
 * @example Node/MCP 场景(有 cloud-bridge)
 * ```ts
 * import { createLokvis } from '@lokvis/sdk';
 * import { aiToolsPlugin } from '@lokvis/plugin-ai';
 * import { createAiClient, resolveCloudConfig } from '@lokvis/cloud-bridge';
 *
 * const config = resolveCloudConfig();
 * const aiClient = createAiClient(config);
 * const lokvis = await createLokvis({
 *   plugins: [aiToolsPlugin({ cloudCaller: aiClient })],
 * });
 * ```
 */
export function aiToolsPlugin(options?: { cloudCaller?: AiCloudCaller }) {
  const cloudCaller = options?.cloudCaller;
  return definePlugin(
    {
      name: PLUGIN_NAME,
      version: PLUGIN_VERSION,
      description:
        'AI tools: ocr / caption / background-remove / generate-workflow / optimize-workflow / diagnose-error',
      capabilities: AI_CAPABILITIES,
      // AI 涉及双引擎:transformers-js(本地推理)+ cloud-proxy(云端),
      // engine 字段为单一标识,这里填主引擎名;各 capability 实现的 engine
      // 在 operations.ts 中按 entry.engine 精确指定。
      engine: 'transformers-js',
      permissions: ['asset:read', 'asset:write', 'network:none'],
    },
    (ctx) => {
      const impls = buildAiCapabilityImplementations(ctx, cloudCaller);
      for (const impl of impls) {
        ctx.registerCapability(impl);
      }
      const cloudStatus = cloudCaller
        ? 'cloud-proxy: live (cloudCaller injected)'
        : 'cloud-proxy: stub (no cloudCaller)';
      ctx.log(
        'info',
        `Registered ${impls.length} AI capabilities (${cloudStatus})`
      );
    }
  );
}
