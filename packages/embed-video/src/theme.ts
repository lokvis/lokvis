/**
 * Video 工具主题系统(Layer 2 共用)。
 *
 * CSS 变量命名空间:--lokvis-video-*
 *
 * 复用 @lokvis/embed-kit 的参数化工厂,以本包原有导出名再导出,
 * 保持三方定制 API 不变。
 *
 * 双层支持:
 *   1. theme prop(对象):<EmbedVideoCompress theme={{ primary: '#0f0' }} />
 *   2. CSS 变量:上层选择器定义 --lokvis-video-* 覆盖(运行时)
 *
 * mode 自适应:mode="system"(默认)通过 useEmbedVideoMode 解析 light/dark。
 */
import { makeThemeSystem, type EmbedModeCore, type EmbedThemeCore } from '@lokvis/embed-kit';

/** 主题模式(light / dark / system,默认 system) */
export type EmbedVideoMode = EmbedModeCore;

/** 主题对象。所有字段可选,未提供的字段使用 CSS 默认值。 */
export type EmbedVideoTheme = EmbedThemeCore;

const themeSystem = makeThemeSystem('--lokvis-video');

/** theme 对象转换为 CSS 变量样式对象。 */
export const themeToCssVars = themeSystem.themeToCssVars;

/** 监听 mode prop,返回解析后的实际主题模式('light' | 'dark')。 */
export const useEmbedVideoMode = themeSystem.useEmbedMode;
