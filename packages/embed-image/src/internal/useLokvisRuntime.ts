/**
 * useLokvisRuntime — 共享 hook,初始化 @lokvis/sdk runtime 并注入插件。
 *
 * 复用 @lokvis/embed-kit 的参数化工厂,默认插件为 imageToolsPlugin()。
 * 以本包原有导出名再导出,保持 API 不变。
 *
 * W23:接受可选 `plugins` 参数,三方接入可在同一 Runtime 内组合 image / audio /
 * pdf / video 插件。不传或 undefined 时回落到默认 [imageToolsPlugin()](向后兼容);
 * 传入空数组 `[]` 表示显式不加载任何插件(用于纯 Runtime 容器场景)。
 */
import { createUseLokvisRuntime, type UseLokvisRuntimeResult } from '@lokvis/embed-kit';
import { imageToolsPlugin } from '@lokvis/sdk/image';

export type { UseLokvisRuntimeResult };

export const useLokvisRuntime = createUseLokvisRuntime(() => [imageToolsPlugin()]);
