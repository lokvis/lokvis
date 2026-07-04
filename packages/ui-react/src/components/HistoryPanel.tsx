/**
 * HistoryPanel - 历史栈面板(W7.1 / W9.1)
 *
 * 展示当前工作流的执行历史,支持:
 * - Undo / Redo 按钮(根据 cursor 禁用)
 * - 点击条目直接跳转(jumpTo)
 * - cursor 当前位置高亮,cursor 之后的条目标灰(redo 分支)
 *
 * W9.1: 支持 `variant` 切换布局方向
 *   - `vertical`(默认):侧栏垂直布局,适合嵌入左/右栏
 *   - `horizontal`:底部横条布局,作为底部 history bar 使用
 *
 * 数据来自 history-slice(store 单一来源),由 runtime-slice 的
 * history:changed 订阅自动更新,组件无需自行订阅事件。
 *
 * 历史条目渲染:把 HistoryEntry 的 capability + params 摘要为可读标签。
 */

import type { HistoryEntry } from '@lokvis/schema';
import { Icon } from '@lokvis/ui-core';
import { useWorkspaceStore } from '../store/index.js';

export interface HistoryPanelProps {
  className?: string;
  /** 布局方向(W9.1):vertical 侧栏,horizontal 底部横条 */
  variant?: 'vertical' | 'horizontal';
}

export function HistoryPanel({ className = '', variant = 'vertical' }: HistoryPanelProps) {
  const entries = useWorkspaceStore((s) => s.historyEntries);
  const cursor = useWorkspaceStore((s) => s.historyCursor);
  const workflowId = useWorkspaceStore((s) => s.historyWorkflowId);
  const undo = useWorkspaceStore((s) => s.undo);
  const redo = useWorkspaceStore((s) => s.redo);
  const jumpTo = useWorkspaceStore((s) => s.jumpToHistory);

  const canUndo = cursor >= 0;
  const canRedo = cursor < entries.length - 1;
  const horizontal = variant === 'horizontal';

  const undoBtn = (
    <button
      type="button"
      onClick={() => void undo()}
      disabled={!canUndo}
      aria-label="Undo"
      className="rounded p-1 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-700 disabled:cursor-not-allowed disabled:opacity-30 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
    >
      <Icon size={13}>
        <path d="M9 14L4 9l5-5" />
        <path d="M4 9h11a4 4 0 0 1 0 8h-3" />
      </Icon>
    </button>
  );
  const redoBtn = (
    <button
      type="button"
      onClick={() => void redo()}
      disabled={!canRedo}
      aria-label="Redo"
      className="rounded p-1 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-700 disabled:cursor-not-allowed disabled:opacity-30 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
    >
      <Icon size={13}>
        <path d="M15 14l5-5-5-5" />
        <path d="M20 9H9a4 4 0 0 0 0 8h3" />
      </Icon>
    </button>
  );

  const headerEl = (
    <div
      className={`flex shrink-0 items-center justify-between px-3 ${
        horizontal ? 'h-full border-r border-zinc-200 dark:border-zinc-800' : 'h-10 border-b border-zinc-200 dark:border-zinc-800'
      }`}
    >
      <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
        History
      </span>
      <div className="flex items-center gap-0.5">
        {undoBtn}
        {redoBtn}
      </div>
    </div>
  );

  // 空状态
  if (!workflowId || entries.length === 0) {
    return (
      <aside
        className={`flex shrink-0 ${
          horizontal
            ? 'h-12 flex-row items-center border-t border-zinc-200 dark:border-zinc-800'
            : 'w-48 flex-col border-r border-zinc-200 dark:border-zinc-800'
        } ${className}`}
        aria-label="History panel"
      >
        {headerEl}
        <p className="px-3 text-[10px] text-zinc-400">No history yet</p>
      </aside>
    );
  }

  if (horizontal) {
    // 横向布局:header | entries(横向滚动)
    return (
      <aside
        className={`flex h-12 shrink-0 items-stretch border-t border-zinc-200 dark:border-zinc-800 ${className}`}
        aria-label="History panel"
      >
        {headerEl}
        <ol className="flex flex-1 items-center gap-1 overflow-x-auto px-2">
          {/* 初始状态项 */}
          <li className="shrink-0">
            <button
              type="button"
              onClick={() => void jumpTo(-1)}
              className={`flex items-center gap-1.5 rounded px-2 py-1 text-[10px] transition-colors ${
                cursor === -1
                  ? 'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200 dark:bg-indigo-950/30 dark:text-indigo-300 dark:ring-indigo-800'
                  : 'text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-800'
              }`}
            >
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-zinc-300 dark:bg-zinc-600" aria-hidden="true" />
              <span className="truncate">Initial</span>
            </button>
          </li>
          {entries.map((entry, i) => {
            const isCurrent = i === cursor;
            const isRedoBranch = i > cursor;
            return (
              <li key={entry.id} className="shrink-0">
                <button
                  type="button"
                  onClick={() => void jumpTo(i)}
                  aria-current={isCurrent ? 'step' : undefined}
                  className={`flex items-center gap-1.5 rounded px-2 py-1 text-[10px] transition-colors ${
                    isCurrent
                      ? 'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200 dark:bg-indigo-950/30 dark:text-indigo-300 dark:ring-indigo-800'
                      : isRedoBranch
                      ? 'text-zinc-300 hover:bg-zinc-50 dark:text-zinc-600 dark:hover:bg-zinc-800/50'
                      : 'text-zinc-600 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-800'
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                      isCurrent
                        ? 'bg-indigo-500'
                        : isRedoBranch
                        ? 'bg-zinc-200 dark:bg-zinc-700'
                        : 'bg-zinc-400 dark:bg-zinc-500'
                    }`}
                    aria-hidden="true"
                  />
                  <span className="truncate font-medium">{describeHistoryEntry(entry)}</span>
                </button>
              </li>
            );
          })}
        </ol>
      </aside>
    );
  }

  // 垂直布局(原实现)
  return (
    <aside
      className={`flex w-48 shrink-0 flex-col border-r border-zinc-200 dark:border-zinc-800 ${className}`}
      aria-label="History panel"
    >
      {headerEl}
      <div className="flex-1 overflow-y-auto px-2 py-2">
        <ol className="space-y-0.5">
          {/* 初始状态项(index=-1) */}
          <li>
            <button
              type="button"
              onClick={() => void jumpTo(-1)}
              className={`flex w-full items-center gap-1.5 rounded px-2 py-1 text-left text-[10px] transition-colors ${
                cursor === -1
                  ? 'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200 dark:bg-indigo-950/30 dark:text-indigo-300 dark:ring-indigo-800'
                  : 'text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-800'
              }`}
            >
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-zinc-300 dark:bg-zinc-600" aria-hidden="true" />
              <span className="truncate">Initial</span>
            </button>
          </li>
          {entries.map((entry, i) => {
            const isCurrent = i === cursor;
            const isRedoBranch = i > cursor;
            return (
              <li key={entry.id}>
                <button
                  type="button"
                  onClick={() => void jumpTo(i)}
                  aria-current={isCurrent ? 'step' : undefined}
                  className={`flex w-full items-start gap-1.5 rounded px-2 py-1 text-left text-[10px] transition-colors ${
                    isCurrent
                      ? 'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200 dark:bg-indigo-950/30 dark:text-indigo-300 dark:ring-indigo-800'
                      : isRedoBranch
                      ? 'text-zinc-300 hover:bg-zinc-50 dark:text-zinc-600 dark:hover:bg-zinc-800/50'
                      : 'text-zinc-600 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-800'
                  }`}
                >
                  <span
                    className={`mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full ${
                      isCurrent
                        ? 'bg-indigo-500'
                        : isRedoBranch
                        ? 'bg-zinc-200 dark:bg-zinc-700'
                        : 'bg-zinc-400 dark:bg-zinc-500'
                    }`}
                    aria-hidden="true"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">
                      {describeHistoryEntry(entry)}
                    </div>
                    <div className="text-[9px] text-zinc-400">
                      {new Date(entry.timestamp).toLocaleTimeString()}
                    </div>
                  </div>
                </button>
              </li>
            );
          })}
        </ol>
      </div>
    </aside>
  );
}

/** 把 HistoryEntry 摘要为可读标签(capability 简称 + 关键参数) */
function describeHistoryEntry(entry: HistoryEntry): string {
  // image.resize → Resize;image.watermark → Watermark
  const short = entry.capability.replace(/^image\./, '');
  const cap = short.charAt(0).toUpperCase() + short.slice(1);
  const params = entry.params ?? {};
  // 摘取 1-2 个关键参数作为提示
  const hints: string[] = [];
  if (typeof params.width === 'number' || typeof params.width === 'string') {
    hints.push(`${params.width}w`);
  }
  if (typeof params.quality === 'number') {
    hints.push(`q${params.quality}`);
  }
  if (typeof params.format === 'string') {
    hints.push(String(params.format));
  }
  if (typeof params.text === 'string' && params.text) {
    hints.push(`"${String(params.text).slice(0, 8)}"`);
  }
  return hints.length > 0 ? `${cap} (${hints.join(' ')})` : cap;
}
