/**
 * ProgressBar - 工作流执行进度条 + 取消按钮(W11.6)
 *
 * 展示:
 *   - 节点完成进度(成功数 / 总数)
 *   - 横向进度条(running 时动画)
 *   - Cancel 按钮(调用 cancelRun)
 *   - 状态消息(statusMessage)
 *
 * 仅在 running 或最近一次执行有结果时显示。
 *
 * @module ProgressBar
 */

import { Icon } from '@lokvis/ui-core';
import { useWorkspaceStore } from '../store/index.js';

export interface ProgressBarProps {
  className?: string;
}

export function ProgressBar({ className = '' }: ProgressBarProps) {
  const running = useWorkspaceStore((s) => s.running);
  const nodes = useWorkspaceStore((s) => s.nodes);
  const statusMessage = useWorkspaceStore((s) => s.statusMessage);
  const cancelRun = useWorkspaceStore((s) => s.cancelRun);

  const total = nodes.length;
  // 完成数:success + failed + cancelled(已结束的节点)
  const done = nodes.filter(
    (n) => n.status === 'success' || n.status === 'failed' || n.status === 'cancelled'
  ).length;
  const failedCount = nodes.filter((n) => n.status === 'failed').length;

  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const hasFailure = failedCount > 0;

  // 没有节点或未运行且无最近结果时不渲染
  if (total === 0) return null;
  if (!running && done === 0) return null;

  return (
    <div
      className={`flex items-center gap-2 border-b border-zinc-200 bg-white px-3 py-1.5 dark:border-zinc-800 dark:bg-zinc-900 ${className}`}
      role="status"
      aria-live="polite"
      aria-label={`工作流进度:${done} / ${total}`}
    >
      {/* 进度条 */}
      <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
        <div
          className={`absolute inset-y-0 left-0 transition-all duration-300 ${
            hasFailure
              ? 'bg-red-500'
              : running
              ? 'bg-indigo-500'
              : 'bg-emerald-500'
          } ${running ? 'animate-pulse' : ''}`}
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* 计数 */}
      <span className="shrink-0 text-[10px] font-medium tabular-nums text-zinc-500 dark:text-zinc-400">
        {done}/{total}
        {failedCount > 0 && (
          <span className="ml-1 text-red-500">({failedCount} failed)</span>
        )}
      </span>

      {/* 状态消息(running 时显示) */}
      {running && statusMessage && (
        <span className="hidden shrink-0 truncate text-[10px] text-zinc-400 sm:inline">
          {statusMessage}
        </span>
      )}

      {/* Cancel 按钮(仅 running 时) */}
      {running && (
        <button
          type="button"
          onClick={() => void cancelRun()}
          aria-label="取消运行"
          title="取消运行"
          className="flex shrink-0 items-center gap-1 rounded-md bg-red-50 px-2 py-0.5 text-[10px] font-medium text-red-600 transition-colors hover:bg-red-100 dark:bg-red-950/30 dark:text-red-400 dark:hover:bg-red-900/40"
        >
          <Icon size={10} strokeWidth={3}><path d="M6 6l12 12M6 18L18 6" /></Icon>
          Cancel
        </button>
      )}

      {/* 完成图标(非 running 且有结果) */}
      {!running && done === total && (
        <span
          className={`flex shrink-0 items-center gap-1 text-[10px] font-medium ${
            hasFailure ? 'text-red-500' : 'text-emerald-500'
          }`}
        >
          <Icon size={10} strokeWidth={3}>
            {hasFailure ? (
              <path d="M12 2L2 22h20L12 2zM12 9v5M12 17v.01" />
            ) : (
              <path d="M20 6L9 17l-5-5" />
            )}
          </Icon>
          {hasFailure ? 'Failed' : 'Done'}
        </span>
      )}
    </div>
  );
}
