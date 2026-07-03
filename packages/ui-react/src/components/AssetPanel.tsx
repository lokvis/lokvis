/**
 * AssetPanel - 左侧资产面板
 *
 * 紧凑布局：section header + 上传按钮 + 筛选 + 资产列表。
 * 支持拖拽导入、点击选择、缩略图预览、按类型/关键词筛选、删除(W6.5)。
 */

import * as React from 'react';
import type { AssetType } from '@lokvis/schema';
import { Icon } from '@lokvis/ui-core';
import { useWorkspaceStore } from '../store/index.js';

export interface AssetPanelProps {
  className?: string;
}

/** 类型筛选 chip 显示名 */
const TYPE_LABEL: Record<AssetType, string> = {
  image: 'Image',
  video: 'Video',
  audio: 'Audio',
  pdf: 'PDF',
  text: 'Text',
  data: 'Data',
  unknown: 'Other',
};

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
  // W6.5 筛选:类型 + 关键词(纯 UI 状态,不入 store)
  const [filterType, setFilterType] = React.useState<'all' | AssetType>('all');
  const [searchQuery, setSearchQuery] = React.useState('');
  // B2 修复:跟踪 in-flight exportAsset,避免同一 asset 跨 effect 重跑并发发起
  const inflightRef = React.useRef<Set<string>>(new Set());

  async function handleFiles(files: FileList | File[] | null) {
    if (!files) return;
    const arr = Array.from(files);
    if (arr.length > 0) await importFiles(arr);
  }

  // 自动生成缩略图
  // B2 修复:
  // - cancelled flag:effect 重跑/卸载时,await 完成的 exportAsset 不再创建
  //   ObjectURL 也不 setThumbnail,避免覆盖更新值与孤儿 URL
  // - inflightRef:同一 asset 在上一轮 effect 还在 await 时,新一轮 effect
  //   不再重复发起(批量导入 assets 频繁变化场景)
  React.useEffect(() => {
    if (!runtime) return;
    let cancelled = false;
    const inflight = inflightRef.current;
    for (const asset of assets) {
      if (thumbnails[asset.id]) continue;
      if (asset.type !== 'image') continue;
      if (inflight.has(asset.id)) continue;
      inflight.add(asset.id);
      (async () => {
        try {
          const blob = await runtime.exportAsset(asset.id);
          // effect 已过期或资产已删除:不创建 ObjectURL(零泄漏)
          if (cancelled) return;
          const url = URL.createObjectURL(blob);
          if (cancelled) {
            // 双重检查:await 与 createObjectURL 之间可能被取消
            URL.revokeObjectURL(url);
            return;
          }
          setThumbnail(asset.id, url);
        } catch {
          // ignore export 失败
        } finally {
          inflight.delete(asset.id);
        }
      })();
    }
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assets, runtime]);

  // 资产中实际存在的类型(仅展示有意义的 chip,避免空类型噪音)
  const availableTypes = React.useMemo(() => {
    const set = new Set<AssetType>();
    for (const a of assets) set.add(a.type);
    return Array.from(set);
  }, [assets]);

  // 筛选后的资产列表
  const filteredAssets = React.useMemo(() => {
    let result = assets;
    if (filterType !== 'all') {
      result = result.filter((a) => a.type === filterType);
    }
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      result = result.filter(
        (a) =>
          a.metadata.format.toLowerCase().includes(q) ||
          a.metadata.mimeType.toLowerCase().includes(q)
      );
    }
    return result;
  }, [assets, filterType, searchQuery]);

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
        <span className="text-[11px] tabular-nums text-zinc-400">
          {filterType === 'all' && !searchQuery
            ? assets.length
            : `${filteredAssets.length}/${assets.length}`}
        </span>
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
        <Icon size={16} className="mx-auto">
          <path d="M12 4.5v15m7.5-7.5h-15" />
        </Icon>
        <span className="mt-1 block text-[10px] font-medium">
          {dragging ? 'Drop here' : 'Add files'}
        </span>
      </label>

      {/* W6.5 筛选栏:仅当有资产时显示 */}
      {assets.length > 0 && (
        <div className="px-2 pb-2 space-y-1.5">
          {/* 类型 chips:m10 radiogroup 语义,屏幕阅读器识别为单选组 */}
          <div
            role="radiogroup"
            aria-label="Filter by type"
            className="flex flex-wrap gap-1"
          >
            <button
              type="button"
              role="radio"
              aria-checked={filterType === 'all'}
              onClick={() => setFilterType('all')}
              className={`rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors ${
                filterType === 'all'
                  ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300'
                  : 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700'
              }`}
            >
              All
            </button>
            {availableTypes.map((t) => (
              <button
                key={t}
                type="button"
                role="radio"
                aria-checked={filterType === t}
                onClick={() => setFilterType(t)}
                className={`rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors ${
                  filterType === t
                    ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300'
                    : 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700'
                }`}
              >
                {TYPE_LABEL[t]}
              </button>
            ))}
          </div>
          {/* 搜索框:m4 文案改为与实际过滤行为一致(按 format/mimeType) */}
          <div className="relative">
            <Icon
              size={11}
              className="absolute left-1.5 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none"
            >
              <circle cx="10" cy="10" r="6" />
              <path d="m20 20-5-5" />
            </Icon>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter by type..."
              aria-label="Filter assets by format"
              className="w-full rounded bg-zinc-100 py-1 pl-6 pr-1.5 text-[10px] text-zinc-700 placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-indigo-300 dark:bg-zinc-800 dark:text-zinc-200 dark:placeholder:text-zinc-500"
            />
          </div>
        </div>
      )}

      {/* Asset list */}
      <div className="flex-1 overflow-y-auto px-2 pb-2">
        {assets.length === 0 ? (
          <p className="px-1 py-4 text-center text-[10px] text-zinc-400">
            No assets imported
          </p>
        ) : filteredAssets.length === 0 ? (
          <p className="px-1 py-4 text-center text-[10px] text-zinc-400">
            No assets match filter
          </p>
        ) : (
          <ul className="space-y-1">
            {filteredAssets.map((asset) => {
              const selected = asset.id === selectedAssetId;
              const thumb = thumbnails[asset.id];
              return (
                <li
                  key={asset.id}
                  // M3: 键盘可达 —— tabIndex + role + onKeyDown(Enter/Space 选中)
                  tabIndex={0}
                  role="button"
                  aria-pressed={selected}
                  aria-label={`Select asset ${asset.metadata.format}`}
                  onClick={() => selectAsset(asset.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      selectAsset(asset.id);
                    }
                  }}
                  className={`group flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-all focus:outline-none focus:ring-2 focus:ring-indigo-300 ${
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
                    className="shrink-0 rounded p-0.5 text-zinc-300 opacity-0 transition-all hover:bg-red-50 hover:text-red-500 focus:opacity-100 group-hover:opacity-100 dark:text-zinc-600 dark:hover:bg-red-950/30"
                    aria-label={`Remove asset ${asset.metadata.format}`}
                  >
                    <Icon size={12}><path d="M6 18L18 6M6 6l12 12" /></Icon>
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
