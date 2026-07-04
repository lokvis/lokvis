/**
 * StatusBar - 底部状态栏
 *
 * 紧凑单行:左侧状态指示 + 当前工具 + 进度,右侧在线状态 + 资源统计 + 存储配额。
 *
 * W9.6 新增:
 *   - 当前选中工具名(从 selectedNode 取)
 *   - 执行进度(已完成节点数 / 总节点数)
 *   - 在线状态(navigator.onLine + 事件监听)
 */

import * as React from 'react';
import { useWorkspaceStore } from '../store/index.js';
import { useWorkflowProgress } from '../hooks/useWorkflowProgress.js';

export interface StatusBarProps {
  className?: string;
}

/** 格式化字节数为人类可读(KB/MB/GB) */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

/** useOnlineStatus - 监听 navigator.onLine + online/offline 事件(W9.6) */
function useOnlineStatus(): boolean {
  const [online, setOnline] = React.useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  React.useEffect(() => {
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);
  return online;
}

export function StatusBar({ className = '' }: StatusBarProps) {
  const statusMessage = useWorkspaceStore((s) => s.statusMessage);
  const error = useWorkspaceStore((s) => s.error);
  const running = useWorkspaceStore((s) => s.running);
  const assets = useWorkspaceStore((s) => s.assets);
  const capabilities = useWorkspaceStore((s) => s.capabilities);
  const nodes = useWorkspaceStore((s) => s.nodes);
  const selectedNodeId = useWorkspaceStore((s) => s.selectedNodeId);
  const storageUsage = useWorkspaceStore((s) => s.storageUsage);
  const setError = useWorkspaceStore((s) => s.setError);
  const online = useOnlineStatus();

  // W9.6 当前选中工具名
  const selectedNode = nodes.find((n) => n.id === selectedNodeId);

  // W9.6 执行进度(抽取到共享 hook,与 ProgressBar 共用,避免重复逻辑)
  const { total: totalNodes, done: doneNodes, pct: progressPct } = useWorkflowProgress();

  // W6.7 存储配额压力:>=95% 红(临界),>=80% 琥珀(警告),其余正常
  const ratio = storageUsage ? storageUsage.usage / storageUsage.quota : 0;
  const storageCritical = ratio >= 0.95;
  const storageWarning = ratio >= 0.8 && !storageCritical;

  return (
    <footer
      className={`flex h-7 shrink-0 items-center justify-between border-t border-zinc-200 bg-zinc-50 px-3 dark:border-zinc-800 dark:bg-zinc-950 ${className}`}
    >
      {/* Left: Status — m5 加 aria-live,屏幕阅读器播报状态变化 */}
      <div
        className="flex items-center gap-2 min-w-0"
        role="status"
        aria-live="polite"
      >
        <span className="flex items-center gap-1.5">
          <span
            className={`h-1.5 w-1.5 rounded-full shrink-0 ${
              error
                ? 'bg-red-500'
                : running
                ? 'bg-amber-500 animate-pulse'
                : 'bg-emerald-500'
            }`}
            aria-hidden="true"
          />
          <span className={`truncate text-[10px] ${error ? 'text-red-500' : 'text-zinc-500'}`}>
            {statusMessage}
          </span>
        </span>

        {/* W9.6 当前工具名 */}
        {selectedNode && (
          <>
            <span className="text-zinc-300 dark:text-zinc-700" aria-hidden="true">·</span>
            <span className="shrink-0 font-mono text-[10px] text-indigo-500 dark:text-indigo-400 truncate max-w-[120px]">
              {selectedNode.capability}
            </span>
          </>
        )}

        {/* W9.6 执行进度 */}
        {running && totalNodes > 0 && (
          <>
            <span className="text-zinc-300 dark:text-zinc-700" aria-hidden="true">·</span>
            <span className="shrink-0 tabular-nums text-[10px] text-amber-600 dark:text-amber-400">
              {doneNodes}/{totalNodes} ({progressPct}%)
            </span>
          </>
        )}

        {error && (
          <button
            type="button"
            onClick={() => setError(null)}
            className="shrink-0 text-[10px] text-red-500 underline decoration-red-300 hover:text-red-600 dark:decoration-red-800"
          >
            dismiss
          </button>
        )}
      </div>

      {/* Right: Stats */}
      <div className="flex items-center gap-3 shrink-0 text-[10px] text-zinc-400 tabular-nums">
        {/* W9.6 在线状态 */}
        <span
          className={`flex items-center gap-1 ${online ? 'text-emerald-500' : 'text-amber-500'}`}
          title={online ? 'Online' : 'Offline — running locally, no upload needed'}
          aria-label={online ? 'Online' : 'Offline — files still processed locally'}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${online ? 'bg-emerald-500' : 'bg-amber-500'}`} aria-hidden="true" />
          {online ? 'Online' : 'Offline'}
        </span>
        <span className="text-zinc-300 dark:text-zinc-700" aria-hidden="true">|</span>

        {/* W6.7 存储配额:接近上限时变色警告;m5 加 aria-label 让屏幕阅读器播报告警 */}
        {storageUsage && (
          <>
            <span
              className={`flex items-center gap-1 ${
                storageCritical
                  ? 'text-red-500 font-semibold'
                  : storageWarning
                  ? 'text-amber-500'
                  : 'text-zinc-400'
              }`}
              title={
                storageCritical
                  ? `Storage almost full (${Math.round(ratio * 100)}%) — clean up to free space`
                  : storageWarning
                  ? `Storage nearing limit (${Math.round(ratio * 100)}%)`
                  : `Storage: ${formatBytes(storageUsage.usage)} of ${formatBytes(storageUsage.quota)}`
              }
              aria-label={
                storageCritical
                  ? `Storage critical: ${formatBytes(storageUsage.usage)} of ${formatBytes(storageUsage.quota)} used, ${Math.round(ratio * 100)} percent. Clean up to free space.`
                  : storageWarning
                  ? `Storage warning: ${formatBytes(storageUsage.usage)} of ${formatBytes(storageUsage.quota)} used, ${Math.round(ratio * 100)} percent.`
                  : `Storage: ${formatBytes(storageUsage.usage)} of ${formatBytes(storageUsage.quota)} used.`
              }
              aria-live={storageCritical ? 'assertive' : 'polite'}
            >
              {(storageCritical || storageWarning) && (
                <span className="text-[9px]" aria-hidden="true">⚠</span>
              )}
              {formatBytes(storageUsage.usage)} / {formatBytes(storageUsage.quota)}
            </span>
            <span className="text-zinc-300 dark:text-zinc-700" aria-hidden="true">|</span>
          </>
        )}
        <span>{assets.length} asset{assets.length !== 1 ? 's' : ''}</span>
        <span className="text-zinc-300 dark:text-zinc-700" aria-hidden="true">|</span>
        <span>{capabilities.length} cap{capabilities.length !== 1 ? 's' : ''}</span>
        <span className="text-zinc-300 dark:text-zinc-700" aria-hidden="true">|</span>
        <span>{nodes.length} step{nodes.length !== 1 ? 's' : ''}</span>
      </div>
    </footer>
  );
}
