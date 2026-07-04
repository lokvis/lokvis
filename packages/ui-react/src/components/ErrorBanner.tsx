/**
 * ErrorBanner - 错误信息横幅(W11.3)
 *
 * 当 store.error 非空时显示,展示错误信息并提供:
 *   - 关闭按钮(清除 error)
 *   - 重试按钮(重新执行工作流)
 *
 * 节点失败高亮由 WorkflowEditor 的节点状态颜色处理(已实现);
 * 本组件负责全局错误信息的可见性。
 *
 * @module ErrorBanner
 */

import * as React from 'react';
import { Icon } from '@lokvis/ui-core';
import { useWorkspaceStore } from '../store/index.js';

export interface ErrorBannerProps {
  className?: string;
}

export function ErrorBanner({ className = '' }: ErrorBannerProps) {
  const error = useWorkspaceStore((s) => s.error);
  const setError = useWorkspaceStore((s) => s.setError);
  const run = useWorkspaceStore((s) => s.run);
  const nodes = useWorkspaceStore((s) => s.nodes);
  const running = useWorkspaceStore((s) => s.running);

  const [dismissed, setDismissed] = React.useState(false);

  // error 变化时重置 dismissed
  React.useEffect(() => {
    if (error) setDismissed(false);
  }, [error]);

  if (!error || dismissed) return null;

  const canRetry = nodes.length > 0 && !running;

  return (
    <div
      className={`flex items-start gap-2 border-b border-red-200 bg-red-50 px-3 py-2 dark:border-red-800/50 dark:bg-red-950/20 ${className}`}
      role="alert"
    >
      <Icon size={14} className="mt-0.5 shrink-0 text-red-500">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </Icon>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-medium text-red-700 dark:text-red-400">
          执行出错
        </p>
        <p className="mt-0.5 break-words text-[10px] text-red-600/80 dark:text-red-400/70">
          {error}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {canRetry && (
          <button
            type="button"
            onClick={() => {
              setDismissed(true);
              void run();
            }}
            className="rounded bg-red-100 px-2 py-0.5 text-[10px] font-medium text-red-700 transition-colors hover:bg-red-200 dark:bg-red-900/40 dark:text-red-400 dark:hover:bg-red-900/60"
          >
            重试
          </button>
        )}
        <button
          type="button"
          onClick={() => {
            setDismissed(true);
            setError(null);
          }}
          aria-label="关闭错误信息"
          className="rounded p-0.5 text-red-400 transition-colors hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/40"
        >
          <Icon size={12} strokeWidth={3}><path d="M6 18L18 6M6 6l12 12" /></Icon>
        </button>
      </div>
    </div>
  );
}
