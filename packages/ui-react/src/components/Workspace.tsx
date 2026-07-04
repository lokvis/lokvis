/**
 * Workspace - 完整工作台组件
 *
 * W9 布局:
 *   ┌──────────────────────────────────────────────┐
 *   │ Toolbar                                       │
 *   ├──────┬──────────────┬───────────────────────┤
 *   │Asset │   Canvas     │   Inspector           │
 *   │Panel │   (center)   │   (right)             │
 *   ├──────┴──────────────┴───────────────────────┤
 *   │ PipelineBar                                  │
 *   ├──────────────────────────────────────────────┤
 *   │ HistoryPanel (horizontal, W9.1)              │
 *   ├──────────────────────────────────────────────┤
 *   │ DownloadPanel (W9.5,条件渲染)                │
 *   ├──────────────────────────────────────────────┤
 *   │ StatusBar                                    │
 *   └──────────────────────────────────────────────┘
 *
 * W9 集成:
 *   - 9.1 HistoryPanel 移到底部(horizontal variant)
 *   - 9.2 CommandPalette(⌘K)挂载在 Workspace 内
 *   - 9.3 GlobalDropzone 全屏拖拽 + MIME 校验
 *   - 9.4 Canvas 内置 CompareSlider(before/after)
 *   - 9.5 DownloadPanel 在 HistoryPanel 下方,有 outputs 时显示
 *   - 9.6 StatusBar 已增强(当前工具/进度/在线)
 *   - 9.7 ThemeToggle 通过 Toolbar rightExtra 挂载
 *   - 9.8 响应式:移动端折叠为 drawer 模式
 *
 * 通过 useLokvis 自动初始化 Runtime 与插件。
 *
 * @example
 * ```tsx
 * import { Workspace } from '@lokvis/ui-react';
 * import imageToolsPlugin from '@lokvis/plugin-image';
 *
 * <Workspace plugins={[imageToolsPlugin()]} />
 * ```
 */

import * as React from 'react';
import { Icon } from '@lokvis/ui-core';
import { useLokvis, type UseLokvisOptions } from '../hooks/useLokvis.js';
import { useBreakpoints } from '../hooks/useMediaQuery.js';
import { Toolbar } from './Toolbar.js';
import { AssetPanel } from './AssetPanel.js';
import { HistoryPanel } from './HistoryPanel.js';
import { Canvas } from './Canvas.js';
import { Inspector } from './Inspector.js';
import { PipelineBar } from './PipelineBar.js';
import { StatusBar } from './StatusBar.js';
import { DownloadPanel } from './DownloadPanel.js';
import { CommandPalette, useCommandPalette } from './CommandPalette.js';
import { GlobalDropzone } from './GlobalDropzone.js';
import { ThemeToggle } from './ThemeToggle.js';

export interface WorkspaceProps extends UseLokvisOptions {
  /** 顶部标题 */
  title?: string;
  /** 是否显示状态栏（默认 true） */
  showStatusBar?: boolean;
  /** 是否显示历史面板（默认 true,W7.1） */
  showHistoryPanel?: boolean;
  /** 是否启用全屏拖拽导入（默认 true,W9.3） */
  enableGlobalDropzone?: boolean;
  /** 是否启用 Command Palette ⌘K（默认 true,W9.2） */
  enableCommandPalette?: boolean;
  /** 是否启用 ThemeToggle（默认 true,W9.7） */
  enableThemeToggle?: boolean;
  /** 是否启用 CompareSlider（默认 true,W9.4） */
  enableCompare?: boolean;
  /** 是否启用 DownloadPanel（默认 true,W9.5） */
  enableDownloadPanel?: boolean;
  className?: string;
}

/** W9.8 移动端抽屉切换状态 */
type MobilePanel = 'asset' | 'inspector' | null;

export function Workspace({
  title,
  showStatusBar = true,
  showHistoryPanel = true,
  enableGlobalDropzone = true,
  enableCommandPalette = true,
  enableThemeToggle = true,
  enableCompare = true,
  enableDownloadPanel = true,
  className = '',
  ...lokvisOptions
}: WorkspaceProps) {
  const { status, error } = useLokvis(lokvisOptions);
  const { isMobile } = useBreakpoints();
  const [paletteOpen, setPaletteOpen] = useCommandPalette();
  // W9.8 移动端抽屉:Asset / Inspector 切换显示
  const [mobilePanel, setMobilePanel] = React.useState<MobilePanel>(null);

  // ⌘K 与 CommandPalette 集成:useCommandPalette 内部已注册全局快捷键
  // 这里仅负责渲染面板;paletteOpen 由 hook 管理状态
  void paletteOpen;

  if (status === 'initializing') {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="relative flex h-12 w-12 items-center justify-center">
            <div className="absolute inset-0 rounded-full border-2 border-indigo-200 dark:border-indigo-800" />
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-transparent border-t-indigo-500" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Initializing Runtime</p>
            <p className="mt-1 text-xs text-zinc-400">Loading plugins and capabilities...</p>
          </div>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="flex h-full items-center justify-center px-6">
        <div className="max-w-md rounded-xl border border-red-200 bg-red-50 p-6 text-center dark:border-red-800/50 dark:bg-red-950/20">
          <div className="mb-3 flex h-10 w-10 mx-auto items-center justify-center rounded-full bg-red-100 dark:bg-red-900/40">
            <Icon size={20} className="text-red-500"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></Icon>
          </div>
          <p className="font-semibold text-red-700 dark:text-red-400">Failed to initialize</p>
          <p className="mt-1.5 text-sm text-red-600/80 dark:text-red-400/70">{error}</p>
        </div>
      </div>
    );
  }

  // W9.7 Toolbar rightExtra: ThemeToggle + ⌘K hint
  const toolbarRight = (
    <>
      {enableCommandPalette && (
        <button
          type="button"
          onClick={() => setPaletteOpen(true)}
          aria-label="Open command palette"
          title="Command palette (⌘K)"
          className="flex h-7 items-center gap-1 rounded-md border border-zinc-200 px-1.5 text-[10px] text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:border-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
        >
          <Icon size={11}><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></Icon>
          <kbd className="font-sans">⌘K</kbd>
        </button>
      )}
      {enableThemeToggle && <ThemeToggle />}
      {/* W9.8 移动端面板切换按钮 */}
      {isMobile && (
        <>
          <button
            type="button"
            onClick={() => setMobilePanel(mobilePanel === 'asset' ? null : 'asset')}
            aria-label="Toggle asset panel"
            aria-pressed={mobilePanel === 'asset'}
            className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
          >
            <Icon size={14}><rect x="3" y="3" width="7" height="18" rx="1" /><path d="M14 3h7v18h-7z" opacity="0.3" /></Icon>
          </button>
          <button
            type="button"
            onClick={() => setMobilePanel(mobilePanel === 'inspector' ? null : 'inspector')}
            aria-label="Toggle inspector panel"
            aria-pressed={mobilePanel === 'inspector'}
            className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
          >
            <Icon size={14}><path d="M3 3h7v18H3z" opacity="0.3" /><rect x="14" y="3" width="7" height="18" rx="1" /></Icon>
          </button>
        </>
      )}
    </>
  );

  return (
    <div className={`flex h-full flex-col bg-white dark:bg-zinc-900 ${className}`}>
      {/* Top: Toolbar */}
      <Toolbar title={title} rightExtra={toolbarRight} />

      {/* W9.3 全屏拖拽 */}
      {enableGlobalDropzone && <GlobalDropzone />}

      {/* W9.2 Command Palette */}
      {enableCommandPalette && (
        <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
      )}

      {/* Middle: Panel area */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* W9.8 桌面:三栏并列;移动:Canvas 单独,其他为 overlay drawer */}
        <div
          className={`${
            isMobile
              ? `absolute inset-y-0 left-0 z-20 w-64 max-w-[80vw] transition-transform duration-200 ${
                  mobilePanel === 'asset' ? 'translate-x-0' : '-translate-x-full'
                }`
              : 'relative'
          }`}
        >
          <AssetPanel className="h-full" />
        </div>

        <Canvas className={enableCompare ? '' : ''} />

        <div
          className={`${
            isMobile
              ? `absolute inset-y-0 right-0 z-20 w-72 max-w-[80vw] transition-transform duration-200 ${
                  mobilePanel === 'inspector' ? 'translate-x-0' : 'translate-x-full'
                }`
              : 'relative'
          }`}
        >
          <Inspector className="h-full" />
        </div>

        {/* W9.8 移动端遮罩:点击关闭抽屉 */}
        {isMobile && mobilePanel !== null && (
          <button
            type="button"
            aria-label="Close panel"
            onClick={() => setMobilePanel(null)}
            className="absolute inset-0 z-10 bg-black/30"
          />
        )}
      </div>

      {/* Pipeline bar */}
      <PipelineBar />

      {/* W9.1 History panel (horizontal at bottom) */}
      {showHistoryPanel && <HistoryPanel variant="horizontal" />}

      {/* W9.5 Download panel (条件渲染:有 outputs 时显示) */}
      {enableDownloadPanel && <DownloadPanel />}

      {/* Bottom: StatusBar */}
      {showStatusBar && <StatusBar />}
    </div>
  );
}
