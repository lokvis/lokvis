/**
 * useLokvisRuntime — 共享 hook,初始化 @lokvis/sdk runtime 并注入 PDF 插件。
 *
 * 复用 @lokvis/embed-kit 的参数化工厂,默认插件为 pdfToolsPluginWeb()。
 * 以本包原有导出名再导出,保持 API 不变。
 */
import { createUseLokvisRuntime, type UseLokvisRuntimeResult } from '@lokvis/embed-kit';
import { pdfToolsPluginWeb } from '@lokvis/plugin-pdf/web';

export type { UseLokvisRuntimeResult };

/**
 * 初始化 runtime 并注入 PDF 插件。
 *
 * @param auth 可选的认证信息。
 * @param plugins 可选的预加载插件列表。undefined 时默认 [pdfToolsPluginWeb()]。
 */
export const useLokvisRuntime = createUseLokvisRuntime(() => [pdfToolsPluginWeb()]);
