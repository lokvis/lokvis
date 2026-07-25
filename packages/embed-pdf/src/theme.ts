/**
 * PDF 工具主题系统(Layer 2 共用)。
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
import { useEffect, useState, type CSSProperties } from 'react';

/**
 * 主题模式。
 * - light:浅色板
 * - dark:深色板
 * - system:跟随系统 prefers-color-scheme(默认)
 */
export type EmbedPdfMode = 'light' | 'dark' | 'system';

/**
 * 主题对象。所有字段可选,未提供的字段使用 CSS 默认值。
 */
export interface EmbedPdfTheme {
  /** 主色(按钮选中态、链接)— 默认 #6366f1 */
  primary?: string;
  /** 主色 hover — 默认 #4f46e5 */
  primaryHover?: string;
  /** 组件背景 — 默认 transparent */
  background?: string;
  /** 卡片背景 — 默认 #ffffff(light) / #18181b(dark) */
  surface?: string;
  /** 卡片 hover — 默认 #f4f4f5(light) / #27272a(dark) */
  surfaceHover?: string;
  /** 边框 — 默认 #e4e4e7(light) / #27272a(dark) */
  border?: string;
  /** 主文字 — 默认 #18181b(light) / #f4f4f5(dark) */
  text?: string;
  /** 次要文字 — 默认 #71717a */
  textMuted?: string;
  /** 成功 — 默认 #10b981 */
  success?: string;
  /** 警告 — 默认 #f59e0b */
  warning?: string;
  /** 错误 — 默认 #ef4444 */
  error?: string;
  /** 圆角 — 默认 0.5rem */
  radius?: string;
  /** 字体 — 默认 inherit */
  fontFamily?: string;
  /** focus 环颜色 — 默认 #6366f1(light) / #818cf8(dark) */
  ring?: string;
}

/** theme 对象 key → CSS 变量名映射(--lokvis-pdf-* 命名空间) */
export const THEME_KEY_TO_VAR: Record<keyof EmbedPdfTheme, string> = {
  primary: '--lokvis-pdf-primary',
  primaryHover: '--lokvis-pdf-primary-hover',
  background: '--lokvis-pdf-bg',
  surface: '--lokvis-pdf-surface',
  surfaceHover: '--lokvis-pdf-surface-hover',
  border: '--lokvis-pdf-border',
  text: '--lokvis-pdf-text',
  textMuted: '--lokvis-pdf-text-muted',
  success: '--lokvis-pdf-success',
  warning: '--lokvis-pdf-warning',
  error: '--lokvis-pdf-error',
  radius: '--lokvis-pdf-radius',
  fontFamily: '--lokvis-pdf-font-family',
  ring: '--lokvis-pdf-ring',
};

/**
 * theme 对象转换为 CSS 变量样式对象。
 * 应用到根元素 style 属性,所有子组件通过 var(--lokvis-pdf-*) 引用。
 *
 * 未提供的字段不会生成对应 CSS 变量,回落到 styles.css 中
 * .lokvis-embed-pdf-* 选择器的默认值(或子组件 var() 的 fallback)。
 */
export function themeToCssVars(theme?: EmbedPdfTheme): CSSProperties {
  if (!theme) return {};
  const vars: Record<string, string> = {};
  (Object.keys(THEME_KEY_TO_VAR) as (keyof EmbedPdfTheme)[]).forEach((key) => {
    const value = theme[key];
    if (value !== undefined && value !== null && value !== '') {
      vars[THEME_KEY_TO_VAR[key]] = value;
    }
  });
  return vars as CSSProperties;
}

/**
 * 解析 mode 为实际的 light/dark。
 *
 * - mode="light" / "dark" 直接返回
 * - mode="system" 通过 matchMedia('(prefers-color-scheme: dark)') 检测
 *   - SSR 或无 matchMedia 环境回落为 "light"
 */
function resolveMode(mode: EmbedPdfMode): 'light' | 'dark' {
  if (mode !== 'system') return mode;
  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return 'light';
}

/**
 * 监听 mode prop,返回解析后的实际主题模式。
 *
 * - mode 为 "light" / "dark" 时直接返回,不订阅 matchMedia
 * - mode 为 "system" 时订阅 prefers-color-scheme 变化,系统切换时自动重渲染
 *
 * @param mode 主题模式,默认 "system"
 * @returns 解析后的 'light' | 'dark'
 */
export function useEmbedPdfMode(mode: EmbedPdfMode = 'system'): 'light' | 'dark' {
  const [resolved, setResolved] = useState<'light' | 'dark'>(() => resolveMode(mode));

  useEffect(() => {
    if (mode !== 'system') {
      setResolved(mode);
      return;
    }
    // mode="system":订阅 prefers-color-scheme 变化
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    setResolved(mql.matches ? 'dark' : 'light');
    const handler = (e: MediaQueryListEvent) => setResolved(e.matches ? 'dark' : 'light');
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, [mode]);

  return resolved;
}
