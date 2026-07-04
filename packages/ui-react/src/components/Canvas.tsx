/**
 * Canvas - 中央画布（纯预览）
 *
 * 只负责展示当前选中资产的预览，以及空状态引导。
 * 工作流节点链已移至独立的 PipelineBar 组件。
 *
 * W9.4: 当存在 lastOutputIds 时,可切换到 CompareSlider 模式,
 *       并排展示 before/after。
 */

import * as React from 'react';
import { Icon } from '@lokvis/ui-core';
import { useWorkspaceStore } from '../store/index.js';
import { CompareSlider } from './CompareSlider.js';

export interface CanvasProps {
  className?: string;
}

export function Canvas({ className = '' }: CanvasProps) {
  const selectedAssetId = useWorkspaceStore((s) => s.selectedAssetId);
  const assets = useWorkspaceStore((s) => s.assets);
  const thumbnails = useWorkspaceStore((s) => s.thumbnails);
  const importFiles = useWorkspaceStore((s) => s.importFiles);
  const lastOutputIds = useWorkspaceStore((s) => s.lastOutputIds);
  const selectedOutputId = useWorkspaceStore((s) => s.selectedOutputId);

  const selected = assets.find((a) => a.id === selectedAssetId);
  const preview = selected ? thumbnails[selected.id] : undefined;

  // W9.4 是否有可对比的输出
  const outputId = selectedOutputId ?? lastOutputIds[0] ?? null;
  const outputThumbnail = outputId ? thumbnails[outputId] : undefined;
  const canCompare = !!(preview && outputThumbnail);

  // W9.4 默认开启 compare 模式:当 outputs 生成后,用户首次希望对比
  // 切换状态由用户控制,直到下次 outputs 重新生成时再默认开启
  const [compareMode, setCompareMode] = React.useState(false);
  React.useEffect(() => {
    // outputs 变化时,自动切到 compare 模式(若可以)
    if (lastOutputIds.length > 0 && canCompare) {
      setCompareMode(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastOutputIds]);

  // 全局拖拽支持（直接拖到画布区）
  const [dragOver, setDragOver] = React.useState(false);

  return (
    <main
      className={`relative flex flex-1 flex-col overflow-hidden ${className}`}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        if (e.dataTransfer.files.length > 0) {
          void importFiles(Array.from(e.dataTransfer.files));
        }
      }}
    >
      {/* Preview area */}
      <div className="relative flex flex-1 items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        {/* Subtle grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.35]"
          style={{
            backgroundImage: 'radial-gradient(circle, #d4d4d8 1px, transparent 1px)',
            backgroundSize: '20px 20px',
          }}
        />

        {/* W9.4 Compare 模式切换按钮(右上) */}
        {canCompare && (
          <div className="absolute top-2 right-2 z-20 flex items-center gap-1 rounded-md bg-white/90 p-0.5 shadow-sm backdrop-blur-sm dark:bg-zinc-900/90">
            <button
              type="button"
              onClick={() => setCompareMode(false)}
              aria-pressed={!compareMode}
              className={`rounded px-2 py-1 text-[10px] font-medium transition-colors ${
                !compareMode
                  ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300'
                  : 'text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800'
              }`}
            >
              Single
            </button>
            <button
              type="button"
              onClick={() => setCompareMode(true)}
              aria-pressed={compareMode}
              className={`rounded px-2 py-1 text-[10px] font-medium transition-colors ${
                compareMode
                  ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300'
                  : 'text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800'
              }`}
            >
              Compare
            </button>
          </div>
        )}

        {dragOver && (
          <div className="absolute inset-4 z-10 rounded-xl border-2 border-dashed border-indigo-400 bg-indigo-50/80 flex items-center justify-center dark:border-indigo-600 dark:bg-indigo-950/60">
            <div className="text-center">
              <Icon size={32} className="mx-auto text-indigo-500" strokeWidth={1.5}><path d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" /></Icon>
              <p className="mt-2 text-sm font-medium text-indigo-600 dark:text-indigo-400">Drop files to import</p>
            </div>
          </div>
        )}

        {/* W9.4 Compare 模式:展示 before/after 滑块 */}
        {compareMode && canCompare ? (
          <div className="relative flex max-h-[calc(100%-4rem)] max-w-[calc(100%-4rem)] items-center justify-center">
            <CompareSlider className="max-h-[calc(100vh-12rem)] max-w-full" />
          </div>
        ) : selected ? (
          preview ? (
            <div className="relative">
              <img
                src={preview}
                alt={selected.metadata.format}
                className="max-h-[calc(100%-4rem)] max-w-[calc(100%-4rem)] rounded-lg object-contain shadow-2xl shadow-black/10 ring-1 ring-black/5 dark:shadow-black/30"
              />
              {/* Metadata overlay */}
              <div className="absolute bottom-2 left-2 rounded-lg bg-white/90 px-2.5 py-1 text-[11px] text-zinc-600 shadow-sm backdrop-blur-sm dark:bg-zinc-900/90 dark:text-zinc-300">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{selected.metadata.format.toUpperCase()}</span>
                  {selected.metadata.dimensions && (
                    <>
                      <span className="text-zinc-300">·</span>
                      <span>{selected.metadata.dimensions.width} x {selected.metadata.dimensions.height}</span>
                    </>
                  )}
                  <span className="text-zinc-300">·</span>
                  <span>{(selected.metadata.size / 1024).toFixed(1)} KB</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <div className="h-28 w-28 animate-pulse rounded-xl bg-zinc-200 dark:bg-zinc-800" />
              <span className="text-xs text-zinc-400">Loading preview...</span>
            </div>
          )
        ) : (
          <div className="relative flex flex-col items-center gap-5 px-6 text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-zinc-200/80 dark:bg-zinc-800 dark:ring-zinc-700">
              <Icon size={36} className="text-zinc-300 dark:text-zinc-600" strokeWidth={1.5}>
                <path d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
              </Icon>
            </div>
            <div>
              <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">No asset selected</p>
              <p className="mt-1.5 text-xs text-zinc-400 dark:text-zinc-500">
                {assets.length === 0
                  ? 'Import files to get started, or drag them here'
                  : 'Select an asset from the left panel'}
              </p>
            </div>
            {assets.length === 0 && (
              <label className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-medium text-white shadow-sm cursor-pointer transition-colors hover:bg-indigo-500">
                <Icon size={14}><path d="M12 4.5v15m7.5-7.5h-15" /></Icon>
                Import Files
                <input
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files) void importFiles(Array.from(e.target.files));
                  }}
                />
              </label>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
