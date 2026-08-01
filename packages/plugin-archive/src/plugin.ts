/**
 * Archive Tools Plugin 定义
 *
 * 通过 definePlugin 注册 3 个归档能力声明(archive.zip / unzip / list),
 * installer 阶段把每个能力映射到 engine-archive 的真实现(fflate)。
 */

import { definePlugin } from '@lokvis/plugin-sdk';
import { ARCHIVE_CAPABILITIES } from '@lokvis/capability';
import { ARCHIVE_ENGINE } from '@lokvis/engine-archive';
import { buildArchiveCapabilityImplementations } from './operations.js';

export const PLUGIN_NAME = 'lokvis-archive-tools';
export const PLUGIN_VERSION = '0.1.0';
export const PLUGIN_ENGINE = ARCHIVE_ENGINE.name;

/**
 * 创建归档工具插件
 *
 * @example
 * ```ts
 * import { createLokvis } from '@lokvis/sdk';
 * import { archiveToolsPlugin } from '@lokvis/plugin-archive';
 *
 * const lokvis = await createLokvis({
 *   plugins: [archiveToolsPlugin()],
 * });
 * ```
 */
export function archiveToolsPlugin() {
  return definePlugin(
    {
      name: PLUGIN_NAME,
      version: PLUGIN_VERSION,
      description: 'Official archive tools: zip / unzip / list (fflate)',
      capabilities: ARCHIVE_CAPABILITIES,
      engine: PLUGIN_ENGINE,
      permissions: ['asset:read', 'asset:write', 'network:none'],
    },
    (ctx) => {
      const impls = buildArchiveCapabilityImplementations(ctx);
      for (const impl of impls) {
        ctx.registerCapability(impl);
      }
      ctx.log('info', `Registered ${impls.length} archive capabilities`);
    }
  );
}
