/**
 * Audio Tools Plugin 定义
 *
 * 通过 definePlugin 注册 4 个音频能力声明,
 * installer 阶段把每个能力映射到 engine-audio 的实现。
 */

import { definePlugin } from '@lokvis/plugin-sdk';
import { AUDIO_CAPABILITIES } from '@lokvis/capability';
import { buildAudioCapabilityImplementations } from './operations.js';

export const PLUGIN_NAME = 'lokvis-audio-tools';
export const PLUGIN_VERSION = '0.1.0';

/**
 * 创建音频工具插件
 *
 * @example
 * ```ts
 * import { createLokvis } from '@lokvis/sdk';
 * import { audioToolsPlugin } from '@lokvis/plugin-audio';
 *
 * const lokvis = await createLokvis({
 *   plugins: [audioToolsPlugin()],
 * });
 * ```
 */
export function audioToolsPlugin() {
  return definePlugin(
    {
      name: PLUGIN_NAME,
      version: PLUGIN_VERSION,
      description:
        'Official audio tools: trim / normalize / merge / transcode',
      capabilities: AUDIO_CAPABILITIES,
      // audio 涉及双引擎:web-audio(trim/normalize/merge)+ lamejs(transcode),
      // engine 字段为单一标识,这里填主引擎名;各 capability 实现的 engine
      // 在 operations.ts 中按 entry.engine 精确指定。
      engine: 'web-audio',
      permissions: ['asset:read', 'asset:write', 'network:none'],
    },
    (ctx) => {
      const impls = buildAudioCapabilityImplementations(ctx);
      for (const impl of impls) {
        ctx.registerCapability(impl);
      }
      ctx.log('info', `Registered ${impls.length} audio capabilities`);
    }
  );
}
