/**
 * StatusBar - 底部状态栏
 *
 * 紧凑单行：左侧状态指示，右侧资源统计。
 */

import { useWorkspaceStore } from '../store.js';

export interface StatusBarProps {
  className?: string;
}

export function StatusBar({ className = '' }: StatusBarProps) {
  const statusMessage = useWorkspaceStore((s) => s.statusMessage);
  const error = useWorkspaceStore((s) => s.error);
  const running = useWorkspaceStore((s) => s.running);
  const assets = useWorkspaceStore((s) => s.assets);
  const capabilities = useWorkspaceStore((s) => s.capabilities);
  const nodes = useWorkspaceStore((s) => s.nodes);
  const setError = useWorkspaceStore((s) => s.setError);

  return (
    <footer
      className={`flex h-7 shrink-0 items-center justify-between border-t border-zinc-200 bg-zinc-50 px-3 dark:border-zinc-800 dark:bg-zinc-950 ${className}`}
    >
      {/* Left: Status */}
      <div className="flex items-center gap-2 min-w-0">
        <span className="flex items-center gap-1.5">
          <span
            className={`h-1.5 w-1.5 rounded-full shrink-0 ${
              error
                ? 'bg-red-500'
                : running
                ? 'bg-amber-500 animate-pulse'
                : 'bg-emerald-500'
            }`}
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
        <span>{assets.length} asset{assets.length !== 1 ? 's' : ''}</span>
        <span className="text-zinc-300 dark:text-zinc-700">|</span>
        <span>{capabilities.length} cap{capabilities.length !== 1 ? 's' : ''}</span>
        <span className="text-zinc-300 dark:text-zinc-700">|</span>
        <span>{nodes.length} step{nodes.length !== 1 ? 's' : ''}</span>
      </div>
    </footer>
  );
}
