/**
 * PDF 工具主题系统(Layer 2 共用)。
 *
 * 复用 @lokvis/embed-kit 的参数化工厂(命名空间 --lokvis-pdf-*),
 * 以本包原有导出名再导出,保持三方定制 API 不变。
 *
 * 双层支持:
 *   1. theme prop(对象):<EmbedPdfCompress theme={{ primary: '#0f0' }} />
 *      → themeToCssVars 转 CSS 变量,应用到根元素 style(优先级最高)
 *   2. CSS 变量:在 .lokvis-embed-pdf-* 选择器或上层元素定义 --lokvis-pdf-* 变量
 *      → 纯 CSS 覆盖(运行时)
 *
 * mode 自适应:
 *   - mode="light":根元素 data-embed-mode="light"
 *   - mode="dark":根元素 data-embed-mode="dark"
 *   - mode="system"(默认):useEmbedPdfMode 通过 matchMedia 解析为 light/dark
 */
import { makeThemeSystem, type EmbedModeCore, type EmbedThemeCore } from '@lokvis/embed-kit';

/** 主题模式(light / dark / system,默认 system) */
export type EmbedPdfMode = EmbedModeCore;

/** 主题对象。所有字段可选,未提供的字段使用 CSS 默认值。 */
export type EmbedPdfTheme = EmbedThemeCore;

const themeSystem = makeThemeSystem('--lokvis-pdf');

/** theme 对象 key → CSS 变量名映射(--lokvis-pdf-* 命名空间) */
export const THEME_KEY_TO_VAR = themeSystem.THEME_KEY_TO_VAR;

/** theme 对象转换为 CSS 变量样式对象。 */
export const themeToCssVars = themeSystem.themeToCssVars;

/** 监听 mode prop,返回解析后的实际主题模式('light' | 'dark')。 */
export const useEmbedPdfMode = themeSystem.useEmbedMode;
