/**
 * AssetPanel - 左侧资产面板
 *
 * 紧凑布局：section header + 上传按钮 + 筛选 + 资产列表。
 * 支持拖拽导入、点击选择、缩略图预览、按类型/关键词筛选、删除(W6.5)。
 */

import * as React from 'react';
import type { AssetType } from '@lokvis/schema';
import { FOCUS_RING, Icon, Input } from '@lokvis/ui-core';
import { useWorkspaceStore } from '../store/index.js';
import { useWorkspaceLang } from '../i18n/useWorkspaceLang.js';
import { useWorkspaceTranslations } from '../i18n/utils.js';

export interface AssetPanelProps {
 className?: string;
}

/** 类型筛选 chip 显示名(i18n 字典 key,渲染处翻译) */
const TYPE_LABEL: Record<AssetType, string> = {
 image: 'assetPanel.typeImage',
 video: 'assetPanel.typeVideo',
 audio: 'assetPanel.typeAudio',
 pdf: 'assetPanel.typePdf',
 text: 'assetPanel.typeText',
 data: 'assetPanel.typeData',
 unknown: 'assetPanel.typeOther',
};

export function AssetPanel({ className = '' }: AssetPanelProps) {
 const assets = useWorkspaceStore((s) => s.assets);
 const selectedAssetId = useWorkspaceStore((s) => s.selectedAssetId);
 const thumbnails = useWorkspaceStore((s) => s.thumbnails);
 const importFiles = useWorkspaceStore((s) => s.importFiles);
 const selectAsset = useWorkspaceStore((s) => s.selectAsset);
 const removeAsset = useWorkspaceStore((s) => s.removeAsset);
 const ensureThumbnails = useWorkspaceStore((s) => s.ensureThumbnails);

 const lang = useWorkspaceLang();
 const tr = useWorkspaceTranslations(lang);

 const [dragging, setDragging] = React.useState(false);
 // W6.5 筛选:类型 + 关键词(纯 UI 状态,不入 store)
 const [filterType, setFilterType] = React.useState<'all' | AssetType>('all');
 const [searchQuery, setSearchQuery] = React.useState('');

 async function handleFiles(files: FileList | File[] | null) {
 if (!files) return;
 const arr = Array.from(files);
 if (arr.length > 0) await importFiles(arr);
 }

 // TD-5.1:缩略图生成统一在 store.ensureThumbnails 中管理(创建/替换/释放闭环)。
 // 组件只需在 assets 变化时触发一次,inflight 去重 + 资产存在性检查在 store 内完成。
 React.useEffect(() => {
 ensureThumbnails();
 }, [assets, ensureThumbnails]);

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
 className={`flex w-56 shrink-0 flex-col border-r border-[var(--lokvis-border)] ${className}`}
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
 <div className="flex items-center justify-between px-3 h-[var(--lokvis-panel-header-h)] shrink-0 border-b border-[var(--lokvis-border)]">
 <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--lokvis-fg-subtle)]">
 {tr('assetPanel.title')}
 </span>
 <span className="text-[11px] tabular-nums text-[var(--lokvis-fg-subtle)]">
 {filterType === 'all' && !searchQuery
 ? assets.length
 : `${filteredAssets.length}/${assets.length}`}
 </span>
 </div>

 {/* Upload zone */}
 <label
 className={`m-2 block cursor-pointer rounded-lg border border-dashed px-2 py-3 text-center transition-all ${
 dragging
 ? 'border-[var(--lokvis-primary)] bg-[var(--lokvis-primary)]/10 text-[var(--lokvis-primary)]'
 : 'border-[var(--lokvis-border)] text-[var(--lokvis-fg-subtle)] hover:border-[var(--lokvis-primary)]/50 hover:bg-[var(--lokvis-primary)]/5 hover:text-[var(--lokvis-primary)]'
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
 {dragging ? tr('assetPanel.dropHere') : tr('assetPanel.addFiles')}
 </span>
 </label>

 {/* W6.5 筛选栏:仅当有资产时显示 */}
 {assets.length > 0 && (
 <div className="px-2 pb-2 space-y-1.5">
 {/* 类型 chips:m10 radiogroup 语义,屏幕阅读器识别为单选组 */}
 <div
 role="radiogroup"
 aria-label={tr('assetPanel.filterByType')}
 className="flex flex-wrap gap-1"
 >
 <button
 type="button"
 role="radio"
 aria-checked={filterType === 'all'}
 onClick={() => setFilterType('all')}
 className={`rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors ${
 filterType === 'all'
 ? 'bg-[var(--lokvis-primary)]/15 text-[var(--lokvis-primary)]'
 : 'bg-[var(--lokvis-surface-muted)] text-[var(--lokvis-fg-muted)] hover:bg-[var(--lokvis-border)]'
 }`}
 >
 {tr('assetPanel.all')}
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
 ? 'bg-[var(--lokvis-primary)]/15 text-[var(--lokvis-primary)]'
 : 'bg-[var(--lokvis-surface-muted)] text-[var(--lokvis-fg-muted)] hover:bg-[var(--lokvis-border)]'
 }`}
 >
 {tr(TYPE_LABEL[t])}
 </button>
 ))}
 </div>
 {/* 搜索框:m4 文案改为与实际过滤行为一致(按 format/mimeType) */}
 <Input
 size="sm"
 value={searchQuery}
 onChange={(e) => setSearchQuery(e.target.value)}
 placeholder={tr('assetPanel.filterPlaceholder')}
 aria-label={tr('assetPanel.filterAria')}
 className="bg-[var(--lokvis-surface-muted)] hover:bg-[var(--lokvis-border)]/50"
 leadingIcon={
 <Icon size={11}>
 <circle cx="10" cy="10" r="6" />
 <path d="m20 20-5-5" />
 </Icon>
 }
 />
 </div>
 )}

 {/* Asset list */}
 <div className="flex-1 overflow-y-auto px-2 pb-2">
 {assets.length === 0 ? (
 <p className="px-1 py-4 text-center text-[10px] text-[var(--lokvis-fg-subtle)]">
 {tr('assetPanel.empty')}
 </p>
 ) : filteredAssets.length === 0 ? (
 <p className="px-1 py-4 text-center text-[10px] text-[var(--lokvis-fg-subtle)]">
 {tr('assetPanel.noMatch')}
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
 aria-label={tr('assetPanel.selectAsset', { format: asset.metadata.format })}
 onClick={() => selectAsset(asset.id)}
 onKeyDown={(e) => {
 if (e.key === 'Enter' || e.key === ' ') {
 e.preventDefault();
 selectAsset(asset.id);
 }
 }}
 className={`group flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-all ${FOCUS_RING} ${
 selected
 ? 'bg-[var(--lokvis-primary)]/10 ring-1 ring-[var(--lokvis-primary)]/40'
 : 'hover:bg-[var(--lokvis-surface)]'
 }`}
 >
 <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded bg-[var(--lokvis-surface-muted)]">
 {thumb ? (
 <img src={thumb} alt="" className="h-full w-full object-cover" />
 ) : (
 <span className="text-[10px] font-medium text-[var(--lokvis-fg-subtle)]">{asset.metadata.format.slice(0, 3).toUpperCase()}</span>
 )}
 </div>
 <div className="min-w-0 flex-1">
 <div className="truncate text-[11px] font-medium">
 {asset.metadata.format}
 </div>
 <div className="text-[10px] text-[var(--lokvis-fg-subtle)]">
 {(asset.metadata.size / 1024).toFixed(1)} KB
 </div>
 </div>
 <button
 type="button"
 onClick={(e) => {
 e.stopPropagation();
 void removeAsset(asset.id);
 }}
 className="shrink-0 rounded p-0.5 text-[var(--lokvis-fg-subtle)] opacity-0 transition-all hover:bg-[var(--lokvis-danger)]/10 hover:text-[var(--lokvis-danger)] focus:opacity-100 group-hover:opacity-100"
 aria-label={tr('assetPanel.removeAsset', { format: asset.metadata.format })}
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
