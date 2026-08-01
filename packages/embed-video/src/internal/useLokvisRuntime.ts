/**
 * useLokvisRuntime — 共享 hook,初始化 @lokvis/sdk runtime 并注入 Video 插件。
 *
 * 复用 @lokvis/embed-kit 的参数化工厂,默认插件为 videoToolsPluginWeb()
 * (浏览器版,基于 ffmpeg.wasm,7 个真实操作;ffmpeg.wasm 懒加载,不影响首屏)。
 * 三方也可通过 plugins 选项注入自定义处理插件。
 */
import { createUseLokvisRuntime, type UseLokvisRuntimeResult } from '@lokvis/embed-kit';
import { videoToolsPluginWeb } from '@lokvis/sdk/video';

export type { UseLokvisRuntimeResult };

export const useLokvisRuntime = createUseLokvisRuntime(() => [videoToolsPluginWeb()]);
