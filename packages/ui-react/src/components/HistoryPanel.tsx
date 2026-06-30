/**
 * HistoryPanel - 处理历史面板
 *
 * 监听 Runtime 事件，记录最近处理过的资产与工作流执行。
 * MVP 仅做只读展示，撤销/重做通过 Runtime API（已留接口）。
 */

import * as React from 'react';
import type { LokvisEvent } from '@lokvis/schema';
import { useWorkspaceStore } from '../store.js';

interface HistoryItem {
  id: string;
  type: string;
  message: string;
  timestamp: number;
}

export interface HistoryPanelProps {
  className?: string;
  /** 最大记录数 */
  maxItems?: number;
}

export function HistoryPanel({ className = '', maxItems = 50 }: HistoryPanelProps) {
  const runtime = useWorkspaceStore((s) => s.runtime);
  const [items, setItems] = React.useState<HistoryItem[]>([]);

  React.useEffect(() => {
    if (!runtime) return;
    const push = (e: LokvisEvent) => {
      const item: HistoryItem = {
        id: `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        type: e.type,
        message: formatEvent(e),
        timestamp: Date.now(),
      };
      setItems((prev) => [item, ...prev].slice(0, maxItems));
    };
    // 使用 onAny 订阅所有事件，避免枚举所有类型
    const off = runtime.eventBus.onAny(push);
    return () => {
      off();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runtime]);

  return (
    <aside
      className={`flex h-32 flex-col border-t border-zinc-200 bg-zinc-50/50 dark:border-zinc-800 dark:bg-zinc-950/50 ${className}`}
    >
      <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-1.5 dark:border-zinc-800">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          History
        </h3>
        {items.length > 0 && (
          <button
            type="button"
            onClick={() => setItems([])}
            className="text-xs text-zinc-400 hover:text-zinc-600"
          >
            Clear
          </button>
        )}
      </div>
      <div className="flex-1 overflow-x-auto overflow-y-hidden px-2 py-1.5">
        {items.length === 0 ? (
          <p className="px-2 text-xs text-zinc-400">No history yet</p>
        ) : (
          <ul className="flex h-full items-stretch gap-1.5">
            {items.map((item) => (
              <li
                key={item.id}
                className="flex w-56 flex-none flex-col justify-between rounded border border-zinc-200 bg-white px-2 py-1 text-xs dark:border-zinc-800 dark:bg-zinc-900"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[10px] text-zinc-400">
                    {new Date(item.timestamp).toLocaleTimeString()}
                  </span>
                  <span className="font-mono text-[10px] text-zinc-400">{item.type}</span>
                </div>
                <div className="truncate text-zinc-600 dark:text-zinc-300" title={item.message}>
                  {item.message}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}

function formatEvent(e: LokvisEvent): string {
  switch (e.type) {
    case 'asset:imported':
      return `Imported ${e.metadata.mimeType}`;
    case 'asset:removed':
      return `Removed asset ${e.assetId.slice(0, 8)}`;
    case 'workflow:started':
      return `Workflow started: ${e.workflowId.slice(0, 8)}`;
    case 'workflow:completed':
      return `Workflow ${e.result.status} in ${e.result.duration}ms`;
    case 'workflow:cancelled':
      return 'Workflow cancelled';
    case 'workflow:paused':
      return 'Workflow paused';
    case 'workflow:resumed':
      return 'Workflow resumed';
    case 'node:started':
      return `Node started: ${e.nodeId.slice(0, 8)}`;
    case 'node:finished':
      return `Node finished: ${e.nodeId.slice(0, 8)} (${e.duration}ms)`;
    case 'node:failed':
      return `Node failed: ${e.error.message}`;
    case 'plugin:loaded':
      return `Plugin loaded: ${e.name}@${e.version}`;
    case 'export:completed':
      return `Exported ${e.format} (${(e.size / 1024).toFixed(1)} KB)`;
    case 'capability:registered':
      return `Capability registered: ${e.capability} (${e.engine})`;
    case 'history:changed':
      return `History changed (${e.entries.length} entries)`;
    default:
      return (e as { type: string }).type;
  }
}
