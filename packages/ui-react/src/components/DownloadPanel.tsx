/**
 * DownloadPanel - 工作流输出下载面板(W9.5)
 *
 * 展示上次工作流执行的输出资产,提供:
 * - 单项下载(从 runtime.exportAsset 取 blob,触发浏览器下载)
 * - 全部下载(逐项触发,BATCH_DOWNLOAD_DELAY_MS 间隔,避免浏览器拦截;长期方案见该常量注释)
 * - 清空输出列表
 *
 * 与 apps/playground 的 DownloadManager(独立工具页)不同:本组件是 Workspace
 * 内嵌的轻量面板,数据来自 store.lastOutputIds(由 workflow-slice.run 写入)。
 *
 * 下载命名:`lokvis-output-{assetId前8位}.{ext}`,简洁且避免覆盖。
 * 不引入 JSZip(需新增依赖),用浏览器原生 downloadBlob 实现。
 */

import * as React from 'react';
import { Icon } from '@lokvis/ui-core';
import { useWorkspaceStore } from '../store/index.js';
import { formatBytes } from '../utils.js';

export interface DownloadPanelProps {
 className?: string;
}

/**
 * 批量下载时每项之间的延迟毫秒数。
 *
 * 短期方案:浏览器(尤其 Chrome)会拦截同一 tick 内触发的多个 programmatic
 * `<a download>` 点击,把第一个之后的视为"非用户手势"弹窗拦截。两次下载之间
 * 插入小延迟可绕过该启发式判定。该值是经验值,不是规范要求 —— 不同浏览器
 * 版本行为可能变化。
 *
 * 长期方案:用 JSZip 将多个输出打包成单个 ZIP 下载(只需一次用户手势)。
 * 本组件暂未引入 JSZip 依赖(见文件头注释),待 M2 引入 archive capability 后
 * 一并迁移,届时可移除此常量与 sleep 调用。
 */
const BATCH_DOWNLOAD_DELAY_MS = 200;

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/** 从扩展名或 mime 推断下载扩展名 */
function extFromMime(mime: string): string {
 const sub = mime.split('/')[1] ?? 'bin';
 // image/svg+xml → svg+xml → svg(取 + 前部分)
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

 // 卸载标志:批量下载是异步循环,卸载后不应再 setState
 const mountedRef = React.useRef(true);
 React.useEffect(() => {
 mountedRef.current = true;
 return () => {
 mountedRef.current = false;
 };
 }, []);

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
 if (mountedRef.current) {
 setDownloaded((prev) => new Set(prev).add(id));
 }
 } catch (err) {
 if (mountedRef.current) {
 setError(err instanceof Error ? err.message : String(err));
 }
 }
 }

 async function handleDownloadAll() {
 if (!runtime || batchDownloading) return;
 setBatchDownloading(true);
 setError(null);
 setStatus('Downloading outputs...');
 // 用本地 Set 跟踪本次循环已下载 id,避免 downloaded 闭包快照与 state 不同步
 // (review 反馈:循环中 setDownloaded 更新 state 但闭包 downloaded 不变,
 // 虽有 batchDownloading guard 阻止并发,逻辑上仍应读取最新已下载集合)
 const localDownloaded = new Set(downloaded);
 try {
 for (const asset of outputAssets) {
 // 卸载后立即停止循环(避免对已卸载组件 setState)
 if (!mountedRef.current) return;
 if (localDownloaded.has(asset.id)) continue;
 try {
 const blob = await runtime.exportAsset(asset.id);
 const ext = extFromMime(asset.metadata.mimeType);
 const filename = `lokvis-output-${asset.id.slice(0, 8)}.${ext}`;
 downloadBlob(blob, filename);
 localDownloaded.add(asset.id);
 if (mountedRef.current) {
 setDownloaded((prev) => new Set(prev).add(asset.id));
 }
 await sleep(BATCH_DOWNLOAD_DELAY_MS);
 } catch (err) {
 if (mountedRef.current) {
 setError(err instanceof Error ? err.message : String(err));
 }
 // 单项失败不阻断后续
 }
 }
 if (mountedRef.current) {
 setStatus('Downloads complete');
 }
 } finally {
 if (mountedRef.current) {
 setBatchDownloading(false);
 }
 }
 }

 function handleClear() {
 clearOutputs();
 setDownloaded(new Set());
 }

 if (outputAssets.length === 0) return null;

 return (
 <div
 className={`flex flex-col border-t border-[var(--lokvis-border)] bg-[var(--lokvis-surface)] ${className}`}
 aria-label="Outputs panel"
 >
 <div className="flex items-center justify-between px-3 h-9 shrink-0 border-b border-[var(--lokvis-border)]">
 <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--lokvis-fg-subtle)]">
 Outputs
 </span>
 <span className="text-[11px] tabular-nums text-[var(--lokvis-fg-subtle)]">
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
 className="flex shrink-0 flex-col gap-1 rounded-md border border-[var(--lokvis-border)] p-2"
 >
 <div className="flex items-center gap-2">
 <span className="rounded bg-[var(--lokvis-surface-muted)] px-1 py-0.5 text-[9px] font-medium text-[var(--lokvis-fg-muted)]">
 {asset.metadata.format.toUpperCase()}
 </span>
 {dims && (
 <span className="text-[10px] text-[var(--lokvis-fg-muted)] tabular-nums">
 {dims.width}×{dims.height}
 </span>
 )}
 <span className="text-[10px] text-[var(--lokvis-fg-subtle)] tabular-nums">
 {formatBytes(asset.metadata.size)}
 </span>
 </div>
 <div className="flex items-center gap-1">
 <button
 type="button"
 onClick={() => void handleDownloadOne(asset.id)}
 className={`flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-medium transition-colors ${
 isDownloaded
 ? 'bg-[var(--lokvis-success)]/15 text-[var(--lokvis-success)]'
 : 'bg-[var(--lokvis-primary)]/15 text-[var(--lokvis-primary)] hover:bg-[var(--lokvis-primary)]/25'
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
 className="rounded-md bg-[var(--lokvis-primary-hover)] px-2.5 py-1 text-[10px] font-medium text-[var(--lokvis-primary-fg)] hover:bg-[var(--lokvis-primary)] disabled:cursor-not-allowed disabled:opacity-50"
 >
 {batchDownloading ? 'Downloading...' : 'Download All'}
 </button>
 <button
 type="button"
 onClick={handleClear}
 className="rounded-md px-2 py-1 text-[10px] text-[var(--lokvis-fg-muted)] hover:bg-[var(--lokvis-surface-muted)] hover:text-[var(--lokvis-fg-muted)]"
 >
 Clear
 </button>
 </div>
 </div>

 {error && (
 <p className="px-3 pb-2 text-[10px] text-[var(--lokvis-danger)]" role="alert">
 {error}
 </p>
 )}
 </div>
 );
}
