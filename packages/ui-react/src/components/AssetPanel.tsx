/**
 * AssetPanel - 左侧资产面板
 *
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
      // 异步生成缩略图
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
      className={`flex w-64 flex-col border-r border-zinc-200 dark:border-zinc-800 ${className}`}
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
      <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-2 dark:border-zinc-800">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Assets
        </h2>
        <span className="text-xs text-zinc-400">{assets.length}</span>
      </div>

      <label
        className={`m-3 block cursor-pointer rounded-md border border-dashed px-3 py-5 text-center text-xs transition-colors ${
          dragging
            ? 'border-indigo-500 bg-indigo-50 text-indigo-600 dark:bg-indigo-950/30'
            : 'border-zinc-300 text-zinc-500 hover:border-indigo-500 hover:text-indigo-500 dark:border-zinc-700'
        }`}
      >
        <input
          type="file"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
        + Drop or click to import
      </label>

      <div className="flex-1 overflow-y-auto px-3 pb-3">
        {assets.length === 0 ? (
          <p className="px-2 text-xs text-zinc-400">No assets yet</p>
        ) : (
          <ul className="space-y-1.5">
            {assets.map((asset) => {
              const selected = asset.id === selectedAssetId;
              const thumb = thumbnails[asset.id];
              return (
                <li
                  key={asset.id}
                  onClick={() => selectAsset(asset.id)}
                  className={`group flex cursor-pointer items-center gap-2 rounded-md border px-2 py-1.5 text-xs transition-colors ${
                    selected
                      ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/30'
                      : 'border-zinc-200 hover:border-zinc-300 dark:border-zinc-800 dark:hover:border-zinc-700'
                  }`}
                >
                  <div className="flex h-9 w-9 flex-none items-center justify-center overflow-hidden rounded bg-zinc-100 dark:bg-zinc-800">
                    {thumb ? (
                      <img src={thumb} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-zinc-400">{asset.metadata.format.slice(0, 3)}</span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-mono font-medium">
                      {asset.metadata.format}
                    </div>
                    <div className="text-zinc-400">
                      {(asset.metadata.size / 1024).toFixed(1)} KB
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      void removeAsset(asset.id);
                    }}
                    className="invisible text-zinc-400 hover:text-red-500 group-hover:visible"
                    aria-label="Remove asset"
                  >
                    ×
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
