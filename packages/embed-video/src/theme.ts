/**
 * Video 工具主题系统(Layer 2 共用)。
 *
 * CSS 变量命名空间:--lokvis-video-*
 *
 * 双层支持:
 *   1. theme prop(对象):<EmbedVideoCompress theme={{ primary: '#0f0' }} />
 *      → themeToCssVars 转 CSS 变量,应用到根元素 style(优先级最高)
 *   2. CSS 变量:在 .lokvis-embed-video-* 选择器或上层元素定义 --lokvis-video-* 变量
 *      → 纯 CSS 覆盖(运行时)
 *
 * mode 自适应:
 *   - mode="light":根元素 data-embed-mode="light"
 *   - mode="dark":根元素 data-embed-mode="dark"
 *   - mode="system"(默认):useEmbedVideoMode 通过 matchMedia 解析为 light/dark
 */
import { useEffect, useState, type CSSProperties } from 'react';

/**
 * 主题模式。
 * - light:浅色板
 * - dark:深色板
 * - system:跟随系统 prefers-color-scheme(默认)
 */
export type EmbedVideoMode = 'light' | 'dark' | 'system';

/**
 * 主题对象。所有字段可选,未提供的字段使用 CSS 默认值。
 */
export interface EmbedVideoTheme {
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

/** theme 对象 key → CSS 变量名映射(--lokvis-video-* 命名空间) */
const THEME_KEY_TO_VAR: Record<keyof EmbedVideoTheme, string> = {
  primary: '--lokvis-video-primary',
  primaryHover: '--lokvis-video-primary-hover',
  background: '--lokvis-video-bg',
  surface: '--lokvis-video-surface',
  surfaceHover: '--lokvis-video-surface-hover',
  border: '--lokvis-video-border',
  text: '--lokvis-video-text',
  textMuted: '--lokvis-video-text-muted',
  success: '--lokvis-video-success',
  warning: '--lokvis-video-warning',
  error: '--lokvis-video-error',
  radius: '--lokvis-video-radius',
  fontFamily: '--lokvis-video-font-family',
  ring: '--lokvis-video-ring',
};

/**
 * theme 对象转换为 CSS 变量样式对象。
 * 应用到根元素 style 属性,所有子组件通过 var(--lokvis-video-*) 引用。
 *
 * 未提供的字段不会生成对应 CSS 变量,回落到 styles.css 默认值。
 */
export function themeToCssVars(theme?: EmbedVideoTheme): CSSProperties {
  if (!theme) return {};
  const vars: Record<string, string> = {};
  (Object.keys(THEME_KEY_TO_VAR) as (keyof EmbedVideoTheme)[]).forEach((key) => {
    const value = theme[key];
    if (value !== undefined && value !== null && value !== '') {
      vars[THEME_KEY_TO_VAR[key]] = value;
    }
  });
  return vars as CSSProperties;
}

/**
 * 解析 mode 为实际的 light/dark。
 */
function resolveMode(mode: EmbedVideoMode): 'light' | 'dark' {
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
export function useEmbedVideoMode(mode: EmbedVideoMode = 'system'): 'light' | 'dark' {
  const [resolved, setResolved] = useState<'light' | 'dark'>(() => resolveMode(mode));

  useEffect(() => {
    if (mode !== 'system') {
      setResolved(mode);
      return;
    }
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    setResolved(mql.matches ? 'dark' : 'light');
    const handler = (e: MediaQueryListEvent) => setResolved(e.matches ? 'dark' : 'light');
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, [mode]);

  return resolved;
}
