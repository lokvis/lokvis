/**
 * PDF Tools Plugin — Node 环境版本(基于 pdf-lib 引擎)
 *
 * 与浏览器默认入口 `pdfToolsPlugin()`(全 stub)的区别:
 * - 默认入口所有 capability 标记为 stub,运行时抛错(不加载 pdf-lib)
 * - Node 版直接绑定 `@lokvis/engine-pdf` 的独立 Blob↔Blob 操作
 *   (6 个真实能力 + 2 个 stub:ocr / sign)
 *
 * 实现骨架与浏览器真实版 `/web` 完全一致,共享 buildRealPdfPlugin(见
 * real-plugin.ts),本文件仅注入 Node 环境相关文案。
 *
 * 用途:
 * - MCP Server(Node 端 pdf tool 实际执行器)
 * - 让 mcp-server 的 pdf tool 经 runtime.run() 走完整 capability 系统
 *
 * 通过子路径 `@lokvis/plugin-pdf/node` 导出:
 *   import { pdfToolsPluginNode } from '@lokvis/plugin-pdf/node';
 */
import {
  buildRealPdfPlugin,
  PLUGIN_ENGINE_PDF,
  PDF_INFO_READER_NAME,
} from './real-plugin.js';

/** Node 引擎名(底层仍是 pdf-lib,与浏览器版一致) */
export const PLUGIN_ENGINE_NODE = PLUGIN_ENGINE_PDF;

export { PDF_INFO_READER_NAME };

/**
 * 创建 PDF 工具插件(Node 环境,基于 pdf-lib 引擎)
 *
 * 6 真实(merge/split/compress/rotate/watermark/add-page-numbers)+ 2 stub
 * (ocr/sign),共 8 个 capability 实现。
 *
 * @example
 * ```ts
 * import { createLokvis } from '@lokvis/sdk';
 * import { pdfToolsPluginNode } from '@lokvis/plugin-pdf/node';
 *
 * const lokvis = await createLokvis({
 *   plugins: [await pdfToolsPluginNode()],
 * });
 * ```
 *
 * 注:本函数为 async,与 imageToolsPluginNode 对齐,保留未来引擎初始化
 * (如 pdf-lib 字体预加载)的扩展点。
 */
export async function pdfToolsPluginNode() {
  return buildRealPdfPlugin({
    environmentPhrase: 'Node environment',
    logEngineDesc: 'pdf-lib engine',
  });
}
