/**
 * Image Tools Plugin 定义
 *
 * 通过 definePlugin 注册 8 个图像能力声明，
 * installer 阶段把每个能力映射到 engine-image 的实现。
 */

import { definePlugin } from '@lokvis/plugin-sdk';
import { IMAGE_CAPABILITIES } from '@lokvis/capability';
import { buildImageCapabilityImplementations } from './operations.js';

export const PLUGIN_NAME = 'lokvis-image-tools';
export const PLUGIN_VERSION = '0.1.0';
export const PLUGIN_ENGINE = 'canvas';

/**
 * 创建图像工具插件
 *
 * @example
 * ```ts
 * import { createLokvis } from '@lokvis/sdk';
 * import { imageToolsPlugin } from '@lokvis/plugin-image';
 *
 * const lokvis = await createLokvis({
 *   plugins: [imageToolsPlugin()],
 * });
 * ```
 */
export function imageToolsPlugin() {
  return definePlugin(
    {
      name: PLUGIN_NAME,
      version: PLUGIN_VERSION,
      description:
        'Official image tools: resize / compress / convert / crop / rotate / flip / watermark / background',
      capabilities: IMAGE_CAPABILITIES,
      engine: PLUGIN_ENGINE,
      permissions: ['asset:read', 'asset:write', 'network:none'],
    },
    (ctx) => {
      const impls = buildImageCapabilityImplementations(ctx);
      for (const impl of impls) {
        ctx.registerCapability(impl);
      }
      ctx.log('info', `Registered ${impls.length} image capabilities`);
    }
  );
}
