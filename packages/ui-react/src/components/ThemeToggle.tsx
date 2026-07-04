/**
 * ThemeToggle - 暗色模式切换按钮(W9.7)
 *
 * 使用 `useTheme()` hook 读写 localStorage + 跟随系统偏好。
 * 与 `tokens.css` 的 `.dark` / `.light` 类双触发机制对齐。
 *
 * 交互:
 *   - 左键单击:在 light / dark 之间切换(基于当前 resolvedTheme 决定下一态)
 *   - 右键单击:弹出菜单(light / dark / system 三态)
 *   - ESC:关闭菜单
 *   - 点击菜单外部:关闭菜单
 */

import * as React from 'react';
import { Icon } from '@lokvis/ui-core';
import { useTheme, type ThemeMode } from '../hooks/useTheme.js';

export interface ThemeToggleProps {
  className?: string;
  /** 是否显示文字标签(默认仅图标) */
  showLabel?: boolean;
}

export function ThemeToggle({ className = '', showLabel = false }: ThemeToggleProps) {
  const { theme, resolvedTheme, toggleTheme, setTheme } = useTheme();
  const [menuOpen, setMenuOpen] = React.useState(false);
  const btnRef = React.useRef<HTMLButtonElement>(null);

  // 点击外部关闭菜单 + ESC 关闭
  React.useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (btnRef.current && !btnRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  const isDark = resolvedTheme === 'dark';

  const icon = isDark ? (
    <Icon size={14} strokeWidth={2}>
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </Icon>
  ) : (
    <Icon size={14} strokeWidth={2}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </Icon>
  );

  const label = theme === null ? 'System' : theme === 'dark' ? 'Dark' : 'Light';

  return (
    <div className={`relative ${className}`}>
      <button
        ref={btnRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        onClick={() => toggleTheme()}
        onContextMenu={(e) => {
          e.preventDefault();
          setMenuOpen((v) => !v);
        }}
        aria-label={`Theme: ${label}. Click to toggle, right-click for options.`}
        title={`Theme: ${label} (right-click for options)`}
        className="flex h-8 w-8 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
      >
        {icon}
        {showLabel && <span className="ml-1 text-xs">{label}</span>}
      </button>

      {menuOpen && (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-1 w-32 overflow-hidden rounded-md border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-800 dark:bg-zinc-900"
        >
          {(['light', 'dark', null] as Array<ThemeMode | null>).map((mode) => {
            const isActive = theme === mode;
            const text = mode === null ? 'System' : mode === 'dark' ? 'Dark' : 'Light';
            return (
              <button
                key={mode ?? 'system'}
                type="button"
                role="menuitemradio"
                aria-checked={isActive}
                onClick={() => {
                  setTheme(mode);
                  setMenuOpen(false);
                }}
                className={`flex w-full items-center justify-between px-3 py-1.5 text-left text-xs transition-colors ${
                  isActive
                    ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/30 dark:text-indigo-300'
                    : 'text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800'
                }`}
              >
                <span>{text}</span>
                {isActive && (
                  <Icon size={12} strokeWidth={3}>
                    <path d="M5 13l4 4L19 7" />
                  </Icon>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
