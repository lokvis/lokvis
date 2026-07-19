/**
 * Developer Tools Plugin 定义
 *
 * 提供面向 Plugin 开发者的工具能力：
 * - developer.inspect.capabilities：列出所有已注册能力
 * - developer.inspect.asset：检视资产元数据与结构
 * - developer.validate.workflow：校验 Workflow 定义（不执行）
 * - developer.profile：能力执行耗时剖析
 * - developer.regex.test：正则表达式测试器
 * - developer.diff：文本行级 diff（LCS 算法）
 * - developer.base64：Base64 编解码
 * - developer.hash：哈希计算（SHA-1/256/384/512/MD5）
 * - developer.jwt.decode：JWT 解码器（不验证签名）
 *
 * 该插件不依赖任何外部 Engine，所有能力在 Plugin 内直接实现,
 * 能力实现拆分到 capabilities/ 目录,本文件只保留 definePlugin 编排。
 */

import { definePlugin } from '@lokvis/plugin-sdk';
import { DEV_CAPABILITIES } from '@lokvis/capability';
import { buildDevCapabilityImplementations } from './capabilities/index.js';

export const PLUGIN_NAME = 'lokvis-dev-tools';
export const PLUGIN_VERSION = '0.1.0';

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
      capabilities: DEV_CAPABILITIES,
      permissions: ['asset:read', 'asset:write', 'network:none'],
    },
    (ctx) => {
      const impls = buildDevCapabilityImplementations(ctx);
      for (const impl of impls) {
        ctx.registerCapability(impl);
      }
      ctx.log('info', `Registered ${DEV_CAPABILITIES.length} developer capabilities`);
    }
  );
}
