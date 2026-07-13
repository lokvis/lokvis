/**
 * AI Tools Plugin 定义
 *
 * 通过 definePlugin 注册 5 个 AI 能力声明,
 * installer 阶段把每个能力映射到 engine-ai 的实现。
 *
 * 双引擎:
 * - transformersEngine(本地):ocr / caption / background-remove
 * - cloudProxyEngine(云端):generate-workflow / optimize-workflow
 */

import { definePlugin } from '@lokvis/plugin-sdk';
import { AI_CAPABILITIES } from '@lokvis/capability';
import { buildAiCapabilityImplementations } from './operations.js';

export const PLUGIN_NAME = 'lokvis-ai-tools';
export const PLUGIN_VERSION = '0.1.0';

/**
 * 创建 AI 工具插件
 *
 * @example
 * ```ts
 * import { createLokvis } from '@lokvis/sdk';
 * import { aiToolsPlugin } from '@lokvis/plugin-ai';
 *
 * const lokvis = await createLokvis({
 *   plugins: [aiToolsPlugin()],
 * });
 * ```
 */
export function aiToolsPlugin() {
  return definePlugin(
    {
      name: PLUGIN_NAME,
      version: PLUGIN_VERSION,
      description:
        'AI tools: ocr / caption / background-remove / generate-workflow / optimize-workflow',
      capabilities: AI_CAPABILITIES,
      // AI 涉及双引擎:transformers-js(本地推理)+ cloud-proxy(云端),
      // engine 字段为单一标识,这里填主引擎名;各 capability 实现的 engine
      // 在 operations.ts 中按 entry.engine 精确指定。
      engine: 'transformers-js',
      permissions: ['asset:read', 'asset:write', 'network:none'],
    },
    (ctx) => {
      const impls = buildAiCapabilityImplementations(ctx);
      for (const impl of impls) {
        ctx.registerCapability(impl);
      }
      ctx.log('info', `Registered ${impls.length} AI capabilities`);
    }
  );
}
