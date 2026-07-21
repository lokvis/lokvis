/**
 * Quick Action 主题系统(Layer 2 共用)。
 *
 * 双层支持:
 *   1. theme prop(对象):<ImageQuickCompress theme={{ primary: '#0f0' }} />
 *      → themeToCssVars 转 CSS 变量,应用到根元素 style
 *   2. CSS 变量:.lokvis-quick-compress { --lokvis-primary: #0f0; }
 *      → 纯 CSS 覆盖(运行时)
 *
 * 默认值见 global.css 的 .lokvis-quick-* 选择器。
 * Layer 2 默认 UI 的 Tailwind 类名引用 var(--lokvis-*),
 * 而非硬编码颜色,确保 theme prop / CSS 变量均可覆盖。
 */
import type { CSSProperties } from 'react';

/**
 * 主题对象。所有字段可选,未提供的字段使用 CSS 默认值(见 global.css)。
 */
export interface QuickTheme {
  /** 主色(按钮选中态、链接)— 默认 #6366f1 */
  primary?: string;
  /** 主色 hover — 默认 #4f46e5 */
  primaryHover?: string;
  /** 组件背景 — 默认 transparent */
  background?: string;
  /** 卡片背景 — 默认 #18181b */
  surface?: string;
  /** 卡片 hover — 默认 #27272a */
  surfaceHover?: string;
  /** 边框 — 默认 #27272a */
  border?: string;
  /** 主文字 — 默认 #f4f4f5 */
  text?: string;
  /** 次要文字 — 默认 #71717a */
  textMuted?: string;
  /** 成功(节省) — 默认 #10b981 */
  success?: string;
  /** 警告(增大) — 默认 #f59e0b */
  warning?: string;
  /** 错误 — 默认 #ef4444 */
  error?: string;
  /** 圆角 — 默认 0.5rem */
  radius?: string;
  /** 字体 — 默认 inherit */
  fontFamily?: string;
}

/** theme 对象 key → CSS 变量名映射 */
const THEME_KEY_TO_VAR: Record<keyof QuickTheme, string> = {
  primary: '--lokvis-primary',
  primaryHover: '--lokvis-primary-hover',
  background: '--lokvis-bg',
  surface: '--lokvis-surface',
  surfaceHover: '--lokvis-surface-hover',
  border: '--lokvis-border',
  text: '--lokvis-text',
  textMuted: '--lokvis-text-muted',
  success: '--lokvis-success',
  warning: '--lokvis-warning',
  error: '--lokvis-error',
  radius: '--lokvis-radius',
  fontFamily: '--lokvis-font-family',
};

/**
 * theme 对象转换为 CSS 变量样式对象。
 * 应用到根元素 style 属性,所有子组件通过 var(--lokvis-*) 引用。
 *
 * 未提供的字段不会生成对应 CSS 变量,回落到 global.css 中 .lokvis-quick-*
 * 选择器的默认值。
 */
export function themeToCssVars(theme?: QuickTheme): CSSProperties {
  if (!theme) return {};
  const vars: Record<string, string> = {};
  (Object.keys(THEME_KEY_TO_VAR) as (keyof QuickTheme)[]).forEach((key) => {
    const value = theme[key];
    if (value !== undefined && value !== null && value !== '') {
      vars[THEME_KEY_TO_VAR[key]] = value;
    }
  });
  return vars as CSSProperties;
}
