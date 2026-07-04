/**
 * useTheme - 暗色模式切换 + 持久化(W9.7)
 *
 * 监听并切换 `<html>` 的 `.dark` / `.light` 类,与 `tokens.css` 双触发机制对齐:
 *   - 显式设置:`document.documentElement.classList` 添加 `dark` 或 `light`
 *   - 系统兜底:未显式设置时,`@media prefers-color-scheme` 自动生效
 *
 * 持久化:`localStorage.theme = 'dark' | 'light'`,刷新后恢复。
 * 跨 tab 同步:监听 `storage` 事件,一个 tab 切换,其他 tab 同步生效。
 *
 * 系统偏好变化:未显式设置主题时,跟随 `matchMedia('(prefers-color-scheme: dark)')`。
 *
 * @example
 * ```tsx
 * const { theme, resolvedTheme, toggleTheme, setTheme } = useTheme();
 * ```
 */

import { useCallback, useEffect, useState } from 'react';

export type ThemeMode = 'light' | 'dark';

const STORAGE_KEY = 'lokvis-theme';

function readStoredTheme(): ThemeMode | null {
  if (typeof window === 'undefined') return null;
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    if (v === 'light' || v === 'dark') return v;
  } catch {
    // localStorage 不可用(隐私模式 / iframe 沙箱)— 退回系统偏好
  }
  return null;
}

function readSystemTheme(): ThemeMode {
  if (typeof window === 'undefined' || !window.matchMedia) return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/** 把显式主题应用到 <html>(null 表示清空,回退到系统偏好) */
function applyTheme(theme: ThemeMode | null) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.classList.remove('dark', 'light');
  if (theme === 'dark') root.classList.add('dark');
  else if (theme === 'light') root.classList.add('light');
  // theme === null: 两个类都不加 → 由 @media prefers-color-scheme 接管
}

export interface UseThemeResult {
  /** 用户显式选择的主题(未设置时为 null,跟随系统) */
  theme: ThemeMode | null;
  /** 实际生效的主题(显式选择或系统偏好) */
  resolvedTheme: ThemeMode;
  /** 设置指定主题(传 null 表示跟随系统) */
  setTheme(theme: ThemeMode | null): void;
  /** 在 light / dark 之间切换(无显式主题时基于 resolvedTheme 决定下一态) */
  toggleTheme(): void;
}

export function useTheme(): UseThemeResult {
  const [theme, setThemeState] = useState<ThemeMode | null>(() => readStoredTheme());
  const [systemTheme, setSystemTheme] = useState<ThemeMode>(() => readSystemTheme());

  // 监听系统偏好变化(仅在用户未显式选择时影响 resolvedTheme)
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => setSystemTheme(mq.matches ? 'dark' : 'light');
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  // 应用主题到 <html>
  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  // 跨 tab 同步:监听 storage 事件
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY) return;
      setThemeState(readStoredTheme());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const setTheme = useCallback((next: ThemeMode | null) => {
    setThemeState(next);
    try {
      if (typeof window === 'undefined') return;
      if (next === null) {
        window.localStorage.removeItem(STORAGE_KEY);
      } else {
        window.localStorage.setItem(STORAGE_KEY, next);
      }
    } catch {
      // 写入失败(隐私模式 / quota)— 不影响运行时切换,只是无法持久化
    }
  }, []);

  const toggleTheme = useCallback(() => {
    const resolved = theme ?? systemTheme;
    setTheme(resolved === 'dark' ? 'light' : 'dark');
  }, [theme, systemTheme, setTheme]);

  return {
    theme,
    resolvedTheme: theme ?? systemTheme,
    setTheme,
    toggleTheme,
  };
}
