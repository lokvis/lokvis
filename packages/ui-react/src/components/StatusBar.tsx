/**
 * StatusBar - 底部状态栏
 *
 * 显示 Runtime 状态、错误信息、资产数量等。
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
      className={`flex items-center justify-between border-t border-zinc-200 bg-zinc-50 px-4 py-1.5 text-xs text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400 ${className}`}
    >
      <div className="flex items-center gap-3">
        <span className="flex items-center gap-1.5">
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              error
                ? 'bg-red-500'
                : running
                ? 'bg-amber-500'
                : 'bg-emerald-500'
            }`}
          />
          {error ? 'error' : running ? 'running' : 'ready'}
        </span>
        <span>{statusMessage}</span>
        {error && (
          <button
            type="button"
            onClick={() => setError(null)}
            className="text-red-500 hover:underline"
          >
            dismiss error
          </button>
        )}
      </div>
      <div className="flex items-center gap-4 text-zinc-400">
        <span>{assets.length} assets</span>
        <span>{capabilities.length} caps</span>
        <span>{nodes.length} steps</span>
      </div>
    </footer>
  );
}
