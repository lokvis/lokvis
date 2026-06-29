/**
 * Canvas - 中央画布
 *
 * 显示当前选中资产，或工作流执行后的输出。
 * 也展示工作流节点链。
 */

import * as React from 'react';
import { useWorkspaceStore } from '../store.js';

export interface CanvasProps {
  className?: string;
}

export function Canvas({ className = '' }: CanvasProps) {
  const selectedAssetId = useWorkspaceStore((s) => s.selectedAssetId);
  const assets = useWorkspaceStore((s) => s.assets);
  const thumbnails = useWorkspaceStore((s) => s.thumbnails);
  const nodes = useWorkspaceStore((s) => s.nodes);
  const selectedNodeId = useWorkspaceStore((s) => s.selectedNodeId);
  const selectNode = useWorkspaceStore((s) => s.selectNode);
  const removeNode = useWorkspaceStore((s) => s.removeNode);
  const capabilityMap = useWorkspaceStore((s) => s.capabilityMap);

  const selected = assets.find((a) => a.id === selectedAssetId);
  const preview = selected ? thumbnails[selected.id] : undefined;

  return (
    <main className={`flex flex-1 flex-col overflow-hidden ${className}`}>
      {/* 预览区 */}
      <div className="relative flex flex-1 items-center justify-center overflow-hidden bg-zinc-50 p-6 dark:bg-zinc-950">
        {selected ? (
          preview ? (
            <img
              src={preview}
              alt={selected.metadata.format}
              className="max-h-full max-w-full rounded-md object-contain shadow-md"
            />
          ) : (
            <div className="flex flex-col items-center gap-2 text-sm text-zinc-400">
              <div className="h-32 w-32 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
              <span>Loading preview...</span>
            </div>
          )
        ) : (
          <div className="text-center text-sm text-zinc-400">
            <p className="mb-1">No asset selected</p>
            <p className="text-xs">Import files and select one to begin</p>
          </div>
        )}

        {selected && (
          <div className="absolute bottom-3 left-3 rounded-md bg-white/80 px-2 py-1 text-xs text-zinc-600 backdrop-blur dark:bg-zinc-900/80 dark:text-zinc-300">
            {selected.metadata.dimensions
              ? `${selected.metadata.dimensions.width} × ${selected.metadata.dimensions.height}`
              : selected.metadata.format}{' '}
            · {(selected.metadata.size / 1024).toFixed(1)} KB
          </div>
        )}
      </div>

      {/* 工作流节点链 */}
      <div className="border-t border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Workflow
          </h3>
          <span className="text-xs text-zinc-400">{nodes.length} step(s)</span>
        </div>
        {nodes.length === 0 ? (
          <p className="text-xs text-zinc-400">
            No steps. Add a capability from the right panel.
          </p>
        ) : (
          <ol className="flex flex-wrap items-center gap-2">
            {nodes.map((node, i) => {
              const cap = capabilityMap[node.capability];
              const selected = node.id === selectedNodeId;
              return (
                <React.Fragment key={node.id}>
                  {i > 0 && <span className="text-zinc-400">→</span>}
                  <li
                    onClick={() => selectNode(node.id)}
                    className={`group flex cursor-pointer items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs transition-colors ${
                      selected
                        ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/30'
                        : 'border-zinc-200 dark:border-zinc-800'
                    } ${statusColor(node.status)}`}
                    title={cap?.description ?? node.capability}
                  >
                    <span className="font-mono">{node.capability}</span>
                    <StatusDot status={node.status} />
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeNode(node.id);
                      }}
                      className="text-zinc-400 opacity-0 hover:text-red-500 group-hover:opacity-100"
                      aria-label="Remove step"
                    >
                      ×
                    </button>
                  </li>
                </React.Fragment>
              );
            })}
          </ol>
        )}
      </div>
    </main>
  );
}

function statusColor(status: string): string {
  switch (status) {
    case 'running':
      return 'border-amber-400 bg-amber-50 dark:bg-amber-950/30';
    case 'success':
      return 'border-emerald-400 bg-emerald-50 dark:bg-emerald-950/30';
    case 'failed':
      return 'border-red-400 bg-red-50 dark:bg-red-950/30';
    default:
      return '';
  }
}

function StatusDot({ status }: { status: string }) {
  const color =
    status === 'running'
      ? 'bg-amber-500'
      : status === 'success'
      ? 'bg-emerald-500'
      : status === 'failed'
      ? 'bg-red-500'
      : 'bg-zinc-300 dark:bg-zinc-700';
  return <span className={`h-1.5 w-1.5 rounded-full ${color}`} />;
}
