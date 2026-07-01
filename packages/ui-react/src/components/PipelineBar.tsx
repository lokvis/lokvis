/**
 * PipelineBar - 工作流管道条
 *
 * 显示当前工作流的节点序列，支持选中、删除节点。
 * 位于 Canvas 下方、StatusBar 上方。
 */

import * as React from 'react';
import { useWorkspaceStore } from '../store/index.js';

export interface PipelineBarProps {
  className?: string;
}

export function PipelineBar({ className = '' }: PipelineBarProps) {
  const nodes = useWorkspaceStore((s) => s.nodes);
  const selectedNodeId = useWorkspaceStore((s) => s.selectedNodeId);
  const selectNode = useWorkspaceStore((s) => s.selectNode);
  const removeNode = useWorkspaceStore((s) => s.removeNode);

  return (
    <div className={`flex h-10 shrink-0 items-center gap-2 border-t border-zinc-200 bg-white px-3 dark:border-zinc-800 dark:bg-zinc-900 ${className}`}>
      <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 shrink-0">
        Pipeline
      </span>

      {nodes.length === 0 ? (
        <span className="text-[11px] text-zinc-400">
          Empty &mdash; add capabilities from the right panel
        </span>
      ) : (
        <div className="flex flex-1 items-center gap-1 overflow-x-auto min-w-0">
          {/* Source indicator */}
          <div className="flex items-center gap-1 rounded-md bg-zinc-100 px-2 py-1 text-[10px] font-medium text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400 shrink-0">
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15"/></svg>
            Source
          </div>

          {/* Arrow */}
          <svg className="h-3 w-3 shrink-0 text-zinc-300 dark:text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="m9 5 7 7-7 7" />
          </svg>

          {/* Nodes */}
          {nodes.map((node, i) => {
            const selected = node.id === selectedNodeId;
            return (
              <React.Fragment key={node.id}>
                <button
                  type="button"
                  onClick={() => selectNode(node.id)}
                  className={`group flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-medium transition-all ${
                    selected
                      ? 'bg-indigo-100 text-indigo-700 ring-1 ring-indigo-300 dark:bg-indigo-950/50 dark:text-indigo-300 dark:ring-indigo-700'
                      : node.status === 'running'
                      ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400'
                      : node.status === 'success'
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400'
                      : node.status === 'failed'
                      ? 'bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-400'
                      : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700'
                  }`}
                >
                  <span className="font-mono">{node.capability}</span>
                  <StatusDot status={node.status} />
                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      removeNode(node.id);
                    }}
                    className="ml-0.5 rounded p-0.5 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/40"
                    role="button"
                    aria-label="Remove step"
                  >
                    <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                  </span>
                </button>

                {/* Arrow between nodes */}
                {i < nodes.length - 1 && (
                  <svg className="h-3 w-3 shrink-0 text-zinc-300 dark:text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="m9 5 7 7-7 7" />
                  </svg>
                )}
              </React.Fragment>
            );
          })}

          {/* Output indicator */}
          <svg className="h-3 w-3 shrink-0 text-zinc-300 dark:text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="m9 5 7 7-7 7" />
          </svg>
          <div className="flex items-center gap-1 rounded-md bg-zinc-100 px-2 py-1 text-[10px] font-medium text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400 shrink-0">
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3"/></svg>
            Output
          </div>
        </div>
      )}

      {/* Step count */}
      {nodes.length > 0 && (
        <span className="shrink-0 text-[10px] tabular-nums text-zinc-400">
          {nodes.length} step{nodes.length !== 1 ? 's' : ''}
        </span>
      )}
    </div>
  );
}

function StatusDot({ status }: { status: string }) {
  const color =
    status === 'running'
      ? 'bg-amber-500'
      : status === 'success'
      ? 'bg-emerald-500'
      : status === 'failed'
      ? 'bg-red-500'
      : status === 'pending'
      ? 'bg-zinc-400 dark:bg-zinc-500'
      : 'bg-zinc-300 dark:bg-zinc-600';

  const animate = status === 'running' ? 'animate-pulse' : '';

  return <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${color} ${animate}`} />;
}
