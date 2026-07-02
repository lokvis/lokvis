/**
 * Workspace - 完整工作台组件
 *
 * 标准三栏布局：Toolbar → [AssetPanel | Canvas | Inspector] → PipelineBar → StatusBar
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

import { Icon } from '@lokvis/ui-core';
import { useLokvis, type UseLokvisOptions } from '../hooks/useLokvis.js';
import { Toolbar } from './Toolbar.js';
import { AssetPanel } from './AssetPanel.js';
import { Canvas } from './Canvas.js';
import { Inspector } from './Inspector.js';
import { PipelineBar } from './PipelineBar.js';
import { StatusBar } from './StatusBar.js';

export interface WorkspaceProps extends UseLokvisOptions {
  /** 顶部标题 */
  title?: string;
  /** 是否显示状态栏（默认 true） */
  showStatusBar?: boolean;
  className?: string;
}

export function Workspace({
  title,
  showStatusBar = true,
  className = '',
  ...lokvisOptions
}: WorkspaceProps) {
  const { status, error } = useLokvis(lokvisOptions);

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

  return (
    <div className={`flex h-full flex-col bg-white dark:bg-zinc-900 ${className}`}>
      {/* Top: Toolbar */}
      <Toolbar title={title} />

      {/* Middle: Three-panel area */}
      <div className="flex flex-1 overflow-hidden">
        <AssetPanel />
        <Canvas />
        <Inspector />
      </div>

      {/* Pipeline bar */}
      <PipelineBar />

      {/* Bottom: StatusBar */}
      {showStatusBar && <StatusBar />}
    </div>
  );
}
