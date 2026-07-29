/**
 * 主题系统工厂(@lokvis/embed-kit 共享)。
 *
 * 各 embed 包(image / pdf / video)的主题系统结构完全一致,
 * 仅 CSS 变量命名空间前缀不同(--lokvis / --lokvis-pdf / --lokvis-video)。
 * 本工厂参数化前缀,各包用 makeThemeSystem(prefix) 生成后以原有导出名再导出,
 * 保持三方定制 API(CSS 变量契约 + 导出名)不变。
 *
 * 双层支持:
 *   1. theme prop(对象)→ themeToCssVars 转 CSS 变量,应用到根元素 style(优先级最高)
 *   2. CSS 变量:上层选择器定义 var 覆盖(运行时)
 *
 * mode 自适应:
 *   - "light" / "dark":直接返回
 *   - "system"(默认):useEmbedMode 通过 matchMedia 解析,SSR 回落 light
 */
import { useEffect, useState, type CSSProperties } from 'react';

/**
 * 主题模式。
 * - light:浅色板
 * - dark:深色板
 * - system:跟随系统 prefers-color-scheme(默认)
 */
export type EmbedModeCore = 'light' | 'dark' | 'system';

/**
 * 主题对象。所有字段可选,未提供的字段回落到 styles.css 默认值。
 */
export interface EmbedThemeCore {
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

/** theme 对象 key → CSS 变量后缀(前缀由 makeThemeSystem 注入) */
const KEY_TO_SUFFIX: Record<keyof EmbedThemeCore, string> = {
  primary: '-primary',
  primaryHover: '-primary-hover',
  background: '-bg',
  surface: '-surface',
  surfaceHover: '-surface-hover',
  border: '-border',
  text: '-text',
  textMuted: '-text-muted',
  success: '-success',
  warning: '-warning',
  error: '-error',
  radius: '-radius',
  fontFamily: '-font-family',
  ring: '-ring',
};

/** makeThemeSystem 返回的主题原语集合 */
export interface ThemeSystem {
  /** theme 对象 key → 完整 CSS 变量名映射(含命名空间前缀) */
  THEME_KEY_TO_VAR: Record<keyof EmbedThemeCore, string>;
  /** theme 对象转 CSS 变量样式对象 */
  themeToCssVars: (theme?: EmbedThemeCore) => CSSProperties;
  /** 监听 mode,返回解析后的 'light' | 'dark' */
  useEmbedMode: (mode?: EmbedModeCore) => 'light' | 'dark';
}

/**
 * 生成某个命名空间前缀下的主题系统。
 *
 * @param prefix CSS 变量命名空间前缀,如 '--lokvis' / '--lokvis-pdf' / '--lokvis-video'
 */
export function makeThemeSystem(prefix: string): ThemeSystem {
  const THEME_KEY_TO_VAR = Object.fromEntries(
    (Object.keys(KEY_TO_SUFFIX) as (keyof EmbedThemeCore)[]).map((key) => [
      key,
      `${prefix}${KEY_TO_SUFFIX[key]}`,
    ])
  ) as Record<keyof EmbedThemeCore, string>;

  function themeToCssVars(theme?: EmbedThemeCore): CSSProperties {
    if (!theme) return {};
    const vars: Record<string, string> = {};
    (Object.keys(THEME_KEY_TO_VAR) as (keyof EmbedThemeCore)[]).forEach((key) => {
      const value = theme[key];
      if (value !== undefined && value !== null && value !== '') {
        vars[THEME_KEY_TO_VAR[key]] = value;
      }
    });
    return vars as CSSProperties;
  }

  function resolveMode(mode: EmbedModeCore): 'light' | 'dark' {
    if (mode !== 'system') return mode;
    if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return 'light';
  }

  function useEmbedMode(mode: EmbedModeCore = 'system'): 'light' | 'dark' {
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

  return { THEME_KEY_TO_VAR, themeToCssVars, useEmbedMode };
}
