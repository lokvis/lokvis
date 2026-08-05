/**
 * PDF Tools Plugin 定义
 *
 * 通过 definePlugin 注册 7 个 PDF 能力声明，
 * installer 阶段把每个能力映射到 engine-pdf 的实现。
 */

import { definePlugin, registerImplementations } from '@lokvis/plugin-sdk';
import { PDF_CAPABILITIES } from '@lokvis/capability';
import { buildPdfCapabilityImplementations } from './operations.js';

export const PLUGIN_NAME = 'lokvis-pdf-tools';
export const PLUGIN_VERSION = '0.1.0';
export const PLUGIN_ENGINE = 'pdf-lib';

/**
 * 创建 PDF 工具插件
 *
 * @example
 * ```ts
 * import { createLokvis } from '@lokvis/sdk';
 * import { pdfToolsPlugin } from '@lokvis/plugin-pdf';
 *
 * const lokvis = await createLokvis({
 *   plugins: [pdfToolsPlugin()],
 * });
 * ```
 */
export function pdfToolsPlugin() {
  return definePlugin(
    {
      name: PLUGIN_NAME,
      version: PLUGIN_VERSION,
      description:
        'Official PDF tools: merge / split / compress / rotate / watermark / ocr / sign',
      capabilities: PDF_CAPABILITIES,
      engine: PLUGIN_ENGINE,
      permissions: ['asset:read', 'asset:write', 'network:none'],
    },
    (ctx) => {
      const impls = buildPdfCapabilityImplementations(ctx);
      registerImplementations(ctx, impls);
      ctx.log('info', `Registered ${impls.length} pdf capabilities`);
    }
  );
}
