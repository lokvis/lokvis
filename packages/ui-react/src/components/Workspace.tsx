/**
 * Workspace - 完整工作台组件
 *
 * 组合 Toolbar / AssetPanel / Canvas / Inspector / HistoryPanel / StatusBar。
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

import { useLokvis, type UseLokvisOptions } from '../hooks/useLokvis.js';
import { Toolbar } from './Toolbar.js';
import { AssetPanel } from './AssetPanel.js';
import { Canvas } from './Canvas.js';
import { Inspector } from './Inspector.js';
import { HistoryPanel } from './HistoryPanel.js';
import { StatusBar } from './StatusBar.js';

export interface WorkspaceProps extends UseLokvisOptions {
  /** 顶部标题 */
  title?: string;
  /** 是否显示历史面板（默认 true） */
  showHistory?: boolean;
  /** 是否显示状态栏（默认 true） */
  showStatusBar?: boolean;
  className?: string;
}

export function Workspace({
  title,
  showHistory = true,
  showStatusBar = true,
  className = '',
  ...lokvisOptions
}: WorkspaceProps) {
  const { status, error } = useLokvis(lokvisOptions);

  if (status === 'initializing') {
    return (
      <div className="flex h-full items-center justify-center text-sm text-zinc-400">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-300 border-t-indigo-500" />
          <p>Initializing Lokvis Runtime...</p>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="flex h-full items-center justify-center text-sm text-red-500">
        <div className="max-w-md rounded-md border border-red-200 bg-red-50 p-4 text-center dark:border-red-900 dark:bg-red-950/30">
          <p className="font-semibold">Failed to initialize</p>
          <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex h-full flex-col bg-white dark:bg-zinc-900 ${className}`}>
      <Toolbar title={title} />
      <div className="flex flex-1 overflow-hidden">
        <AssetPanel />
        <Canvas />
        <Inspector />
      </div>
      {showHistory && <HistoryPanel />}
      {showStatusBar && <StatusBar />}
    </div>
  );
}
