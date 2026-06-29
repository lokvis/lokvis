/**
 * Video Tools Plugin 定义
 *
 * 通过 definePlugin 注册 7 个视频能力声明，
 * installer 阶段把每个能力映射到 engine-video 的实现。
 */

import { definePlugin } from '@lokvis/plugin-sdk';
import { VIDEO_CAPABILITIES } from '@lokvis/capability';
import { buildVideoCapabilityImplementations } from './operations.js';

export const PLUGIN_NAME = 'lokvis-video-tools';
export const PLUGIN_VERSION = '0.1.0';
export const PLUGIN_ENGINE = 'ffmpeg-wasm';

/**
 * 创建视频工具插件
 *
 * @example
 * ```ts
 * import { createLokvis } from '@lokvis/sdk';
 * import { videoToolsPlugin } from '@lokvis/plugin-video';
 *
 * const lokvis = await createLokvis({
 *   plugins: [videoToolsPlugin()],
 * });
 * ```
 */
export function videoToolsPlugin() {
  return definePlugin(
    {
      name: PLUGIN_NAME,
      version: PLUGIN_VERSION,
      description:
        'Official video tools: compress / transcode / trim / merge / extract-audio / to-gif / screenshot',
      capabilities: VIDEO_CAPABILITIES,
      engine: PLUGIN_ENGINE,
      permissions: ['asset:read', 'asset:write', 'network:none'],
    },
    (ctx) => {
      const impls = buildVideoCapabilityImplementations(ctx);
      for (const impl of impls) {
        ctx.registerCapability(impl);
      }
      ctx.log('info', `Registered ${impls.length} video capabilities`);
    }
  );
}
