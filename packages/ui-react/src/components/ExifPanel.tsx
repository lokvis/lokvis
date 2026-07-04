/**
 * ExifPanel - EXIF 元数据查看面板(W7.4)
 *
 * 监听当前选中的 image asset,通过 runtime.readAssetExif 桥接调用
 * plugin-image 注册的 MetadataReader,展示结构化 EXIF 字段。
 *
 * 架构合规(长期方案):
 * - UI 只依赖 @lokvis/schema(ExifData 类型 + formatExifRows)和 @lokvis/runtime
 * - 不直接依赖 plugin-image / engine-image(五层单向依赖)
 * - ExifData 类型不含 raw 字段(schema 层类型分层),UI 缓存无需手动剔除
 *
 * 设计要点:
 * - 独立可折叠面板(渲染在 Inspector 顶部)
 * - 仅 image 类型 asset 显示;非 image 隐藏整个面板
 * - 缓存:按 assetId 缓存(LRU 上限 16),切换 asset 不重复解析
 * - effect 依赖 selectedAssetId(而非 asset 对象引用),避免 assets 数组
 *   重渲染时触发重复 effect
 * - 取消:effect 重跑/卸载时不更新 state(避免 stale update)
 * - 加载/空态/错误三态明确
 */

import * as React from 'react';
import { Icon } from '@lokvis/ui-core';
import { formatExifRows, type ExifData } from '@lokvis/schema';
import { useWorkspaceStore } from '../store/index.js';

export interface ExifPanelProps {
  className?: string;
}

/** cache LRU 上限:防止长会话切换大量图片时 Map 无限增长 */
const EXIF_CACHE_LIMIT = 16;

export function ExifPanel({ className = '' }: ExifPanelProps) {
  const selectedAssetId = useWorkspaceStore((s) => s.selectedAssetId);
  const assets = useWorkspaceStore((s) => s.assets);
  const runtime = useWorkspaceStore((s) => s.runtime);

  const selectedAsset = React.useMemo(
    () => assets.find((a) => a.id === selectedAssetId) ?? null,
    [assets, selectedAssetId]
  );

  // 仅 image 类型 asset 显示 EXIF 面板
  const isImage = selectedAsset?.type === 'image';
  // effect 依赖用 id 而非 asset 引用:避免 assets 数组重渲染触发重复 effect
  const selectedAssetIdForEffect = selectedAsset?.id;

  const [open, setOpen] = React.useState(true);
  const [exif, setExif] = React.useState<ExifData | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // 按 assetId 缓存解析结果,避免切换来回重复解析
  const cacheRef = React.useRef<Map<string, ExifData | null>>(new Map());

  React.useEffect(() => {
    if (!isImage || !selectedAssetIdForEffect || !runtime) {
      setExif(null);
      setError(null);
      setLoading(false);
      return;
    }

    const assetId = selectedAssetIdForEffect;
    const cache = cacheRef.current;

    // 命中缓存:同步设置,不发请求(LRU 命中后重排到末尾)
    if (cache.has(assetId)) {
      const cached = cache.get(assetId) ?? null;
      cache.delete(assetId);
      cache.set(assetId, cached);
      setExif(cached);
      setError(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        // 通过 runtime.readAssetExif 桥接(MetadataReader 依赖反转),
        // UI 不直接依赖 plugin-image / engine-image
        const data = await runtime.readAssetExif(assetId);
        if (cancelled) return;
        // LRU 上限:超出时删除最旧 entry(Map 第一个,即最近最少命中)
        if (cache.size >= EXIF_CACHE_LIMIT) {
          const oldestKey = cache.keys().next().value;
          if (oldestKey !== undefined) cache.delete(oldestKey);
        }
        cache.set(assetId, data);
        setExif(data);
        setError(null);
      } catch (err) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : 'Failed to read EXIF';
        setError(msg);
        setExif(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isImage, selectedAssetIdForEffect, runtime]);

  // 非 image 或无选中 asset:不渲染(避免占用布局空间)
  if (!isImage || !selectedAsset) return null;

  const rows = exif ? formatExifRows(exif) : [];

  return (
    <div
      className={`shrink-0 border-b border-zinc-200 dark:border-zinc-800 ${className}`}
    >
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-3 h-10 text-left transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
        aria-expanded={open}
      >
        <div className="flex items-center gap-2">
          <Icon
            size={12}
            className={`text-zinc-400 transition-transform ${open ? 'rotate-90' : ''}`}
          >
            <path d="m9 5 7 7-7 7" />
          </Icon>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
            EXIF
          </span>
        </div>
        {loading ? (
          <span className="text-[10px] text-zinc-400">loading…</span>
        ) : exif ? (
          <span className="font-mono text-[10px] text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 dark:text-emerald-400 px-1.5 py-0.5 rounded">
            {rows.length} fields
          </span>
        ) : error ? (
          <span className="text-[10px] text-red-500">error</span>
        ) : (
          <span className="text-[10px] text-zinc-400">none</span>
        )}
      </button>

      {open && (
        <div className="px-3 pb-3 max-h-60 overflow-y-auto">
          {loading ? (
            <div className="py-4 text-center text-[11px] text-zinc-400">
              Reading EXIF…
            </div>
          ) : error ? (
            <div className="py-3 text-center">
              <p className="text-[11px] text-red-500">{error}</p>
            </div>
          ) : rows.length === 0 ? (
            <div className="py-4 text-center">
              <p className="text-[11px] text-zinc-400">No EXIF data</p>
              <p className="mt-1 text-[10px] text-zinc-500">
                This image has no embedded metadata
              </p>
            </div>
          ) : (
            <dl className="space-y-1">
              {rows.map((row) => (
                <div
                  key={row.label}
                  className="flex items-baseline justify-between gap-3 text-[11px]"
                >
                  <dt className="shrink-0 text-zinc-400">{row.label}</dt>
                  <dd className="truncate text-right font-mono text-zinc-700 dark:text-zinc-300">
                    {row.value}
                  </dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      )}
    </div>
  );
}
