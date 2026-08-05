/**
 * useLokvisRuntime — 共享 hook,初始化 @lokvis/sdk runtime 并注入插件(FO-16 工厂化)。
 *
 * 所有工具页(compress/resize/convert/crop/watermark)共用此 hook。
 * runtime 在组件 unmount 时自动 cancel('all')。
 */
import { createUseLokvisRuntime } from '@lokvis/embed-kit';
import { imageToolsPlugin } from '@lokvis/plugin-image';

export type { UseLokvisRuntimeResult } from '@lokvis/embed-kit';

export const useLokvisRuntime = createUseLokvisRuntime(() => [imageToolsPlugin()]);
