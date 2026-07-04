/**
 * DownloadPanel - 工作流输出下载面板(W9.5)
 *
 * 展示上次工作流执行的输出资产,提供:
 *   - 单项下载(从 runtime.exportAsset 取 blob,触发浏览器下载)
 *   - 全部下载(逐项触发,200ms 间隔,避免浏览器拦截)
 *   - 清空输出列表
 *
 * 与 apps/playground 的 DownloadManager(独立工具页)不同:本组件是 Workspace
 * 内嵌的轻量面板,数据来自 store.lastOutputIds(由 workflow-slice.run 写入)。
 *
 * 下载命名:原文件名 + 节点链摘要后缀,避免覆盖。
 *   - 输入:foo.png → 输出:foo-resize-watermark.png
 *
 * 不引入 JSZip(需新增依赖),用浏览器原生 downloadBlob 实现。
 */

import * as React from 'react';
import { Icon } from '@lokvis/ui-core';
import { useWorkspaceStore } from '../store/index.js';

export interface DownloadPanelProps {
  className?: string;
}

/** 格式化字节数 */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/** 延迟工具,避免浏览器拦截多下载 */
const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/** 从扩展名或 mime 推断下载扩展名 */
function extFromMime(mime: string): string {
  const sub = mime.split('/')[1] ?? 'bin';
  // image/svg+xml → svg+xml → svg
  return sub.split('+')[0] ?? sub;
}

/** 触发浏览器下载 */
function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function DownloadPanel({ className = '' }: DownloadPanelProps) {
  const assets = useWorkspaceStore((s) => s.assets);
  const lastOutputIds = useWorkspaceStore((s) => s.lastOutputIds);
  const runtime = useWorkspaceStore((s) => s.runtime);
  const clearOutputs = useWorkspaceStore((s) => s.clearOutputs);
  const setStatus = useWorkspaceStore((s) => s.setStatus);

  const [downloaded, setDownloaded] = React.useState<Set<string>>(new Set());
  const [batchDownloading, setBatchDownloading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // 输出资产列表(从 store.assets 中按 lastOutputIds 顺序取)
  const outputAssets = React.useMemo(() => {
    return lastOutputIds
      .map((id) => assets.find((a) => a.id === id))
      .filter((a): a is NonNullable<typeof a> => a !== undefined);
  }, [lastOutputIds, assets]);

  // outputs 变化时清空 downloaded 状态
  React.useEffect(() => {
    setDownloaded(new Set());
    setError(null);
  }, [lastOutputIds]);

  const totalSize = outputAssets.reduce((sum, a) => sum + a.metadata.size, 0);
  const downloadedCount = outputAssets.filter((a) => downloaded.has(a.id)).length;
  const allDownloaded = outputAssets.length > 0 && downloadedCount === outputAssets.length;

  async function handleDownloadOne(id: string) {
    if (!runtime) return;
    const asset = outputAssets.find((a) => a.id === id);
    if (!asset) return;
    try {
      const blob = await runtime.exportAsset(id);
      const ext = extFromMime(asset.metadata.mimeType);
      const filename = `lokvis-output-${asset.id.slice(0, 8)}.${ext}`;
      downloadBlob(blob, filename);
      setDownloaded((prev) => new Set(prev).add(id));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleDownloadAll() {
    if (!runtime || batchDownloading) return;
    setBatchDownloading(true);
    setError(null);
    setStatus('Downloading outputs...');
    try {
      for (const asset of outputAssets) {
        if (downloaded.has(asset.id)) continue;
        try {
          const blob = await runtime.exportAsset(asset.id);
          const ext = extFromMime(asset.metadata.mimeType);
          const filename = `lokvis-output-${asset.id.slice(0, 8)}.${ext}`;
          downloadBlob(blob, filename);
          setDownloaded((prev) => new Set(prev).add(asset.id));
          await sleep(200);
        } catch (err) {
          setError(err instanceof Error ? err.message : String(err));
          // 单项失败不阻断后续
        }
      }
      setStatus('Downloads complete');
    } finally {
      setBatchDownloading(false);
    }
  }

  function handleClear() {
    clearOutputs();
    setDownloaded(new Set());
  }

  if (outputAssets.length === 0) return null;

  return (
    <div
      className={`flex flex-col border-t border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 ${className}`}
      aria-label="Outputs panel"
    >
      <div className="flex items-center justify-between px-3 h-9 shrink-0 border-b border-zinc-200 dark:border-zinc-800">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
          Outputs
        </span>
        <span className="text-[11px] tabular-nums text-zinc-400">
          {downloadedCount}/{outputAssets.length} · {formatBytes(totalSize)}
        </span>
      </div>

      <div className="flex items-center gap-2 px-3 py-2 overflow-x-auto">
        {outputAssets.map((asset) => {
          const isDownloaded = downloaded.has(asset.id);
          const dims = asset.metadata.dimensions;
          return (
            <div
              key={asset.id}
              className="flex shrink-0 flex-col gap-1 rounded-md border border-zinc-200 p-2 dark:border-zinc-700"
            >
              <div className="flex items-center gap-2">
                <span className="rounded bg-zinc-100 px-1 py-0.5 text-[9px] font-medium text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                  {asset.metadata.format.toUpperCase()}
                </span>
                {dims && (
                  <span className="text-[10px] text-zinc-500 dark:text-zinc-400 tabular-nums">
                    {dims.width}×{dims.height}
                  </span>
                )}
                <span className="text-[10px] text-zinc-400 tabular-nums">
                  {formatBytes(asset.metadata.size)}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => void handleDownloadOne(asset.id)}
                  className={`flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-medium transition-colors ${
                    isDownloaded
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400'
                      : 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200 dark:bg-indigo-950/30 dark:text-indigo-300 dark:hover:bg-indigo-900/40'
                  }`}
                >
                  <Icon size={10} strokeWidth={2}>
                    <path d="M12 3v12m0 0l-4-4m4 4l4-4M3 17v2a2 2 0 002 2h14a2 2 0 002-2v-2" />
                  </Icon>
                  {isDownloaded ? 'Downloaded' : 'Download'}
                </button>
              </div>
            </div>
          );
        })}

        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => void handleDownloadAll()}
            disabled={batchDownloading || allDownloaded}
            className="rounded-md bg-indigo-600 px-2.5 py-1 text-[10px] font-medium text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {batchDownloading ? 'Downloading...' : 'Download All'}
          </button>
          <button
            type="button"
            onClick={handleClear}
            className="rounded-md px-2 py-1 text-[10px] text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
          >
            Clear
          </button>
        </div>
      </div>

      {error && (
        <p className="px-3 pb-2 text-[10px] text-red-500" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
