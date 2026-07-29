/**
 * Canvas - 中央画布（纯预览）
 *
 * 只负责展示当前选中资产的预览，以及空状态引导。
 * 工作流节点链已移至独立的 PipelineBar 组件。
 *
 * W9.4: 当存在 lastOutputIds 时,可切换到 CompareSlider 模式,
 * 并排展示 before/after。
 */

import * as React from 'react';
import { Icon } from '@lokvis/ui-core';
import { useWorkspaceStore } from '../store/index.js';
import { CompareSlider } from './CompareSlider.js';
import { useWorkspaceLang } from '../i18n/useWorkspaceLang.js';
import { useWorkspaceTranslations } from '../i18n/utils.js';

export interface CanvasProps {
 className?: string;
 /**
 * 是否启用 before/after 对比模式(W9.4)。
 * 默认 true;关闭后即使有 outputs 也只显示单图预览。
 */
 enableCompare?: boolean;
 /**
  * 自定义空状态(无选中资产时渲染),替换内置的引导 UI。
  * 不传时使用默认空状态(导入引导 + Import Files 按钮)。
  */
 emptyState?: React.ReactNode;
}

export function Canvas({ className = '', enableCompare = true, emptyState }: CanvasProps) {
 const selectedAssetId = useWorkspaceStore((s) => s.selectedAssetId);
 const assets = useWorkspaceStore((s) => s.assets);
 const thumbnails = useWorkspaceStore((s) => s.thumbnails);
 const importFiles = useWorkspaceStore((s) => s.importFiles);
 const lastOutputIds = useWorkspaceStore((s) => s.lastOutputIds);
 const selectedOutputId = useWorkspaceStore((s) => s.selectedOutputId);

 const lang = useWorkspaceLang();
 const t = useWorkspaceTranslations(lang);

 const selected = assets.find((a) => a.id === selectedAssetId);
 const preview = selected ? thumbnails[selected.id] : undefined;

 // W9.4 是否有可对比的输出
 const outputId = selectedOutputId ?? lastOutputIds[0] ?? null;
 const outputThumbnail = outputId ? thumbnails[outputId] : undefined;
 const canCompare = enableCompare && !!(preview && outputThumbnail);

 // W9.4 默认开启 compare 模式:当 outputs 生成后,用户首次希望对比
 // 切换状态由用户控制,直到下次 outputs 重新生成时再默认开启
 const [compareMode, setCompareMode] = React.useState(false);
 // 记录上次已自动切到 compare 模式的 outputId。
 // 修复 review:原 effect 依赖 [lastOutputIds, preview, outputThumbnail],
 // 当用户手动切到 Single 后再切换选中资产,preview 变化会触发 effect
 // 把 compareMode 强制重置为 true,覆盖用户选择。
 // 现在仅在 outputId 真正变化(新 run 完成 / 切换输出)且 preview/outputThumbnail
 // 都就绪时才自动切换;同一 outputId 下 preview / outputThumbnail 的异步变化
 // 不会覆盖用户已选择的 Single 模式。
 const lastAutoSwitchedOutputId = React.useRef<string | null>(null);
 React.useEffect(() => {
 if (
 outputId !== null &&
 outputId !== lastAutoSwitchedOutputId.current &&
 preview &&
 outputThumbnail
 ) {
 lastAutoSwitchedOutputId.current = outputId;
 setCompareMode(true);
 }
 }, [outputId, preview, outputThumbnail]);

 // 全局拖拽支持（直接拖到画布区）
 const [dragOver, setDragOver] = React.useState(false);

 return (
 <main
 className={`relative flex flex-1 flex-col overflow-hidden ${className}`}
 onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
 onDragLeave={() => setDragOver(false)}
 onDrop={(e) => {
 e.preventDefault();
 // stopPropagation 防止事件冒泡到 window 的 GlobalDropzone 监听,
 // 否则文件会被导入两次(Canvas 处理一次 + GlobalDropzone 再处理一次)
 e.stopPropagation();
 setDragOver(false);
 if (e.dataTransfer.files.length > 0) {
 void importFiles(Array.from(e.dataTransfer.files));
 }
 }}
 >
 {/* Preview area */}
 <div className="relative flex flex-1 items-center justify-center bg-[var(--lokvis-surface)]">
 {/* Subtle grid pattern */}
 <div
 className="absolute inset-0 opacity-[0.35]"
 style={{
 backgroundImage: 'radial-gradient(circle, var(--lokvis-border) 1px, transparent 1px)',
 backgroundSize: '20px 20px',
 }}
 />

 {/* W9.4 Compare 模式切换按钮(右上) */}
 {canCompare && (
 <div
 role="group"
 aria-label={t('canvas.compareModeAria')}
 className="absolute top-2 right-2 z-20 flex items-center gap-1 rounded-md bg-[var(--lokvis-surface)]/90 p-0.5 shadow-[var(--lokvis-elevation-1)] backdrop-blur-sm"
 >
 <button
 type="button"
 onClick={() => setCompareMode(false)}
 aria-pressed={!compareMode}
 className={`rounded px-2 py-1 text-[11px] font-medium transition-colors ${
 !compareMode
 ? 'bg-[var(--lokvis-primary)]/15 text-[var(--lokvis-primary)]'
 : 'text-[var(--lokvis-fg-muted)] hover:bg-[var(--lokvis-surface-muted)]'
 }`}
 >
 {t('canvas.single')}
 </button>
 <button
 type="button"
 onClick={() => setCompareMode(true)}
 aria-pressed={compareMode}
 className={`rounded px-2 py-1 text-[11px] font-medium transition-colors ${
 compareMode
 ? 'bg-[var(--lokvis-primary)]/15 text-[var(--lokvis-primary)]'
 : 'text-[var(--lokvis-fg-muted)] hover:bg-[var(--lokvis-surface-muted)]'
 }`}
 >
 {t('canvas.compare')}
 </button>
 </div>
 )}

 {dragOver && (
 <div className="absolute inset-4 z-10 rounded-xl border-2 border-dashed border-[var(--lokvis-primary)] bg-[var(--lokvis-primary)]/10 flex items-center justify-center">
 <div className="text-center">
 <Icon size={32} className="mx-auto text-[var(--lokvis-primary)]" strokeWidth={1.5}><path d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" /></Icon>
 <p className="mt-2 text-sm font-medium text-[var(--lokvis-primary)]">{t('canvas.dropToImport')}</p>
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
 className="max-h-[calc(100%-4rem)] max-w-[calc(100%-4rem)] rounded-lg object-contain shadow-[var(--lokvis-elevation-3)] ring-1 ring-[var(--lokvis-border)]/50"
 />
 {/* Metadata overlay */}
 <div className="absolute bottom-2 left-2 rounded-lg bg-[var(--lokvis-surface)]/90 px-2.5 py-1 text-[11px] text-[var(--lokvis-fg-muted)] shadow-[var(--lokvis-elevation-1)] backdrop-blur-sm">
 <div className="flex items-center gap-2">
 <span className="font-medium">{selected.metadata.format.toUpperCase()}</span>
 {selected.metadata.dimensions && (
 <>
 <span className="text-[var(--lokvis-fg-subtle)]">·</span>
 <span>{selected.metadata.dimensions.width} x {selected.metadata.dimensions.height}</span>
 </>
 )}
 <span className="text-[var(--lokvis-fg-subtle)]">·</span>
 <span>{(selected.metadata.size / 1024).toFixed(1)} KB</span>
 </div>
 </div>
 </div>
 ) : (
 <div className="flex flex-col items-center gap-3">
 <div className="h-28 w-28 animate-pulse rounded-xl bg-[var(--lokvis-border)]" />
 <span className="text-xs text-[var(--lokvis-fg-subtle)]">{t('canvas.loadingPreview')}</span>
 </div>
 )
 ) : (
 emptyState ?? (
 <div className="relative flex flex-col items-center gap-5 px-6 text-center">
 <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-[var(--lokvis-surface)] shadow-[var(--lokvis-elevation-1)] ring-1 ring-[var(--lokvis-border)]/80">
 <Icon size={36} className="text-[var(--lokvis-fg-subtle)]" strokeWidth={1.5}>
 <path d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
 </Icon>
 </div>
 <div>
 <p className="text-sm font-medium text-[var(--lokvis-fg-muted)]">{t('canvas.noAsset')}</p>
 <p className="mt-1.5 text-xs text-[var(--lokvis-fg-subtle)]">
 {assets.length === 0
 ? t('canvas.emptyHintImport')
 : t('canvas.emptyHintSelect')}
 </p>
 </div>
 {assets.length === 0 && (
 <label className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-[var(--lokvis-primary-hover)] px-4 py-2 text-xs font-medium text-[var(--lokvis-primary-fg)] shadow-[var(--lokvis-elevation-1)] cursor-pointer transition-colors hover:bg-[var(--lokvis-primary)]">
 <Icon size={14}><path d="M12 4.5v15m7.5-7.5h-15" /></Icon>
 {t('canvas.importFiles')}
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
 )
 )}
 </div>
 </main>
 );
}
