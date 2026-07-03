/**
 * StatusBar - 底部状态栏
 *
 * 紧凑单行：左侧状态指示，右侧资源统计 + 存储配额(W6.7)。
 */

import { useWorkspaceStore } from '../store/index.js';

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

export function StatusBar({ className = '' }: StatusBarProps) {
  const statusMessage = useWorkspaceStore((s) => s.statusMessage);
  const error = useWorkspaceStore((s) => s.error);
  const running = useWorkspaceStore((s) => s.running);
  const assets = useWorkspaceStore((s) => s.assets);
  const capabilities = useWorkspaceStore((s) => s.capabilities);
  const nodes = useWorkspaceStore((s) => s.nodes);
  const storageUsage = useWorkspaceStore((s) => s.storageUsage);
  const setError = useWorkspaceStore((s) => s.setError);

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
