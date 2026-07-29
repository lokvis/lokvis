/**
 * Quick Action 主题系统(Layer 2 共用)。
 *
 * 复用 @lokvis/embed-kit 的参数化工厂(命名空间 --lokvis-*),
 * 以本包原有导出名再导出,保持三方定制 API 不变。
 *
 * 双层支持:
 *   1. theme prop(对象):<EmbedImageCompress theme={{ primary: '#0f0' }} />
 *   2. CSS 变量:在 .lokvis-quick-* 选择器或上层元素定义 --lokvis-* 变量
 *
 * 默认值见 src/styles.css 的 .lokvis-quick-* 选择器。
 * mode 自适应:mode="system"(默认)通过 useEmbedMode 解析 light/dark。
 */
import { makeThemeSystem, type EmbedModeCore, type EmbedThemeCore } from '@lokvis/embed-kit';

/** 主题模式(light / dark / system,默认 system) */
export type EmbedMode = EmbedModeCore;

/** 主题对象。所有字段可选,未提供的字段使用 CSS 默认值(见 styles.css)。 */
export type EmbedTheme = EmbedThemeCore;

const themeSystem = makeThemeSystem('--lokvis');

/** theme 对象转换为 CSS 变量样式对象。 */
export const themeToCssVars = themeSystem.themeToCssVars;

/** 监听 mode prop,返回解析后的实际主题模式('light' | 'dark')。 */
export const useEmbedMode = themeSystem.useEmbedMode;
