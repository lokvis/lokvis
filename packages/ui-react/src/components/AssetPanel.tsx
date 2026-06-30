/**
 * AssetPanel - 左侧资产面板
 *
 * 紧凑布局：section header + 上传按钮 + 资产列表。
 * 支持拖拽导入、点击选择、缩略图预览。
 */

import * as React from 'react';
import { useWorkspaceStore } from '../store.js';

export interface AssetPanelProps {
  className?: string;
}

export function AssetPanel({ className = '' }: AssetPanelProps) {
  const assets = useWorkspaceStore((s) => s.assets);
  const selectedAssetId = useWorkspaceStore((s) => s.selectedAssetId);
  const thumbnails = useWorkspaceStore((s) => s.thumbnails);
  const importFiles = useWorkspaceStore((s) => s.importFiles);
  const selectAsset = useWorkspaceStore((s) => s.selectAsset);
  const removeAsset = useWorkspaceStore((s) => s.removeAsset);
  const setThumbnail = useWorkspaceStore((s) => s.setThumbnail);
  const runtime = useWorkspaceStore((s) => s.runtime);

  const [dragging, setDragging] = React.useState(false);

  async function handleFiles(files: FileList | File[] | null) {
    if (!files) return;
    const arr = Array.from(files);
    if (arr.length > 0) await importFiles(arr);
  }

  // 自动生成缩略图
  React.useEffect(() => {
    if (!runtime) return;
    for (const asset of assets) {
      if (thumbnails[asset.id]) continue;
      if (asset.type !== 'image') continue;
      (async () => {
        try {
          const blob = await runtime.exportAsset(asset.id);
          const url = URL.createObjectURL(blob);
          setThumbnail(asset.id, url);
        } catch {
          // ignore
        }
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assets, runtime]);

  return (
    <aside
      className={`flex w-56 shrink-0 flex-col border-r border-zinc-200 dark:border-zinc-800 ${className}`}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        void handleFiles(e.dataTransfer.files);
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 h-10 shrink-0 border-b border-zinc-200 dark:border-zinc-800">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
          Assets
        </span>
        <span className="text-[11px] tabular-nums text-zinc-400">{assets.length}</span>
      </div>

      {/* Upload zone */}
      <label
        className={`m-2 block cursor-pointer rounded-lg border border-dashed px-2 py-3 text-center transition-all ${
          dragging
            ? 'border-indigo-400 bg-indigo-50 text-indigo-600 dark:bg-indigo-950/30'
            : 'border-zinc-200 text-zinc-400 hover:border-indigo-300 hover:bg-indigo-50/50 hover:text-indigo-500 dark:border-zinc-700 dark:hover:border-indigo-800 dark:hover:bg-indigo-950/20'
        }`}
      >
        <input
          type="file"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
        <svg className="mx-auto h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
        <span className="mt-1 block text-[10px] font-medium">
          {dragging ? 'Drop here' : 'Add files'}
        </span>
      </label>

      {/* Asset list */}
      <div className="flex-1 overflow-y-auto px-2 pb-2">
        {assets.length === 0 ? (
          <p className="px-1 py-4 text-center text-[10px] text-zinc-400">
            No assets imported
          </p>
        ) : (
          <ul className="space-y-1">
            {assets.map((asset) => {
              const selected = asset.id === selectedAssetId;
              const thumb = thumbnails[asset.id];
              return (
                <li
                  key={asset.id}
                  onClick={() => selectAsset(asset.id)}
                  className={`group flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-all ${
                    selected
                      ? 'bg-indigo-50 ring-1 ring-indigo-200 dark:bg-indigo-950/30 dark:ring-indigo-800'
                      : 'hover:bg-zinc-50 dark:hover:bg-zinc-800'
                  }`}
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded bg-zinc-100 dark:bg-zinc-800">
                    {thumb ? (
                      <img src={thumb} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-[10px] font-medium text-zinc-400">{asset.metadata.format.slice(0, 3).toUpperCase()}</span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[11px] font-medium">
                      {asset.metadata.format}
                    </div>
                    <div className="text-[10px] text-zinc-400">
                      {(asset.metadata.size / 1024).toFixed(1)} KB
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      void removeAsset(asset.id);
                    }}
                    className="shrink-0 rounded p-0.5 text-zinc-300 opacity-0 transition-all hover:bg-red-50 hover:text-red-500 group-hover:opacity-100 dark:text-zinc-600 dark:hover:bg-red-950/30"
                    aria-label="Remove asset"
                  >
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </aside>
  );
}
