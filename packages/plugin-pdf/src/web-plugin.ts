/**
 * PDF Tools Plugin — 浏览器环境版本(基于 pdf-lib 引擎)
 *
 * 与默认入口 `pdfToolsPlugin()`(全 stub)的区别:
 * - 默认入口所有 capability 标记为 stub,不加载 pdf-lib(省 ~300KB 首屏)
 * - Web 版直接绑定 `@lokvis/engine-pdf` 的 Blob↔Blob 操作(6 真实 + 2 stub)
 *
 * pdf-lib 经 engine-pdf 内部 `await import('pdf-lib')` 动态加载,
 * 不会进入消费方首屏 bundle——仅在用户实际触发 PDF 处理时按需拉取。
 *
 * 实现骨架与 Node 真实版 `/node` 完全一致,共享 buildRealPdfPlugin(见
 * real-plugin.ts),本文件仅注入浏览器环境相关文案。
 *
 * 用途:
 * - @lokvis/embed-pdf 的 hooks 内部使用(浏览器端 PDF 处理)
 * - 任何需要在浏览器端运行真实 PDF 操作的消费方
 *
 * 通过子路径 `@lokvis/plugin-pdf/web` 导出:
 *   import { pdfToolsPluginWeb } from '@lokvis/plugin-pdf/web';
 */
import {
  buildRealPdfPlugin,
  PLUGIN_ENGINE_PDF,
  PDF_INFO_READER_NAME,
} from './real-plugin.js';

/** Web 引擎名(底层是 pdf-lib,与 Node 版一致) */
export const PLUGIN_ENGINE_WEB = PLUGIN_ENGINE_PDF;

export { PDF_INFO_READER_NAME };

/**
 * 创建 PDF 工具插件(浏览器环境,基于 pdf-lib 引擎)
 *
 * 6 真实(merge/split/compress/rotate/watermark/add-page-numbers)+ 2 stub
 * (ocr/sign),共 8 个 capability 实现。pdf-lib 按需动态加载,不影响首屏。
 *
 * @example
 * ```ts
 * import { createLokvis } from '@lokvis/sdk';
 * import { pdfToolsPluginWeb } from '@lokvis/plugin-pdf/web';
 *
 * const lokvis = await createLokvis({
 *   plugins: [pdfToolsPluginWeb()],
 * });
 * ```
 */
export function pdfToolsPluginWeb() {
  return buildRealPdfPlugin({
    environmentPhrase: 'browser environment',
    logEngineDesc: 'pdf-lib engine, browser',
  });
}
