/**
 * GlobalDropzone - 全屏拖拽导入区 + MIME 类型校验(W9.3)
 *
 * 当用户拖拽文件进入窗口时,显示全屏遮罩引导用户拖到任意位置即可导入。
 * 通过 `accept` 白名单做 MIME 类型校验,拒绝类型时给出视觉反馈 + 警告。
 *
 * 工作机制:
 * 1. 监听 window dragenter / dragover / dragleave / drop 事件
 * 2. dragenter 显示遮罩,dragleave(离开 window)隐藏
 * 3. drop 时校验文件类型 → 合法则 importFiles,非法则提示拒绝原因
 *
 * MIME 校验:
 * - 默认接受所有 image/* 类型(以及 video/audio/pdf 等,与 workspace 多媒体定位对齐)
 * - 拒绝类型在遮罩中央显示红色提示,并阻止导入
 *
 * 与 AssetPanel / Canvas 内置的局部 dropzone 互不冲突:它们各自处理自己的
 * drop 事件并 `stopPropagation()`,本组件的 window drop 监听不会触发。
 *
 * 防御性兜底:即便子组件忘了 `stopPropagation`,本组件也会再次处理 drop 事件,
 * 但通过 `importFiles` 的幂等性(以 File 引用去重)— 不,File 引用并不去重,
 * 所以子组件**必须** `stopPropagation()`。本组件在 drop 事件触发时,先检查
 * `e.defaultPrevented`(子组件会 `preventDefault()` 表明已处理),若已处理
 * 则直接 return,避免双重导入。
 *
 * @example
 * ```tsx
 * <GlobalDropzone accept="image/*" />
 * ```
 */

import * as React from 'react';
import { Icon } from '@lokvis/ui-core';
import { useWorkspaceStore } from '../store/index.js';
import { useWorkspaceLang } from '../i18n/useWorkspaceLang.js';
import { useWorkspaceTranslations } from '../i18n/utils.js';

export interface GlobalDropzoneProps {
 /** 接受的 MIME 类型(逗号分隔),默认接受图片/视频/音频/PDF */
 accept?: string;
 className?: string;
}

/** 默认接受的类型:与 Workspace 多媒体定位对齐 */
const DEFAULT_ACCEPT = 'image/*,video/*,audio/*,application/pdf';

/** 检查单个文件是否符合 accept 白名单 */
function isFileAccepted(file: File, accept: string): boolean {
 if (!accept) return true;
 const patterns = accept.split(',').map((p) => p.trim().toLowerCase()).filter(Boolean);
 if (patterns.length === 0) return true;
 const mime = file.type.toLowerCase();
 const name = file.name.toLowerCase();
 return patterns.some((p) => {
 // image/* → image/(prefix match)
 if (p.endsWith('/*')) {
 return mime.startsWith(p.slice(0, -1));
 }
 // image/jpeg → exact mime match
 if (p.includes('/')) {
 return mime === p;
 }
 // .png → extension match
 if (p.startsWith('.')) {
 return name.endsWith(p);
 }
 return false;
 });
}

export function GlobalDropzone({
 accept = DEFAULT_ACCEPT,
 className = '',
}: GlobalDropzoneProps) {
 const importFiles = useWorkspaceStore((s) => s.importFiles);
 const setStatus = useWorkspaceStore((s) => s.setStatus);
 const setError = useWorkspaceStore((s) => s.setError);

 const lang = useWorkspaceLang();
 const t = useWorkspaceTranslations(lang);

 // dragCounter:用计数器而非布尔,避免子元素 dragenter/dragleave 触发抖动
 const [dragCounter, setDragCounter] = React.useState(0);
 const [rejectedFiles, setRejectedFiles] = React.useState<string[]>([]);
 // W21.6: 持有 rejectedFiles 自动清除定时器,unmount 时 cleanup
 const rejectTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

 React.useEffect(() => {
 // 阻止浏览器默认行为(打开文件 / 下载),否则 drop 不会触发
 const preventDefault = (e: DragEvent) => {
 e.preventDefault();
 e.stopPropagation();
 };
 // dragenter:进入窗口,计数 +1
 const onDragEnter = (e: DragEvent) => {
 preventDefault(e);
 if (e.dataTransfer?.types?.includes('Files')) {
 setDragCounter((c) => c + 1);
 setRejectedFiles([]);
 }
 };
 // dragover:必须 preventDefault 才能触发 drop
 const onDragOver = (e: DragEvent) => {
 preventDefault(e);
 if (e.dataTransfer) {
 // 显示 drop 效果
 e.dataTransfer.dropEffect = 'copy';
 }
 };
 // dragleave:离开窗口,计数 -1
 const onDragLeave = (e: DragEvent) => {
 preventDefault(e);
 // 只在离开 window 时(relatedTarget 为 null 或 document.documentElement)减计数
 // relatedTarget 为 null 表示离开文档边界
 if (e.relatedTarget === null) {
 setDragCounter(0);
 setRejectedFiles([]);
 }
 };
 // drop:校验 + 导入
 const onDrop = (e: DragEvent) => {
 // 兜底:子组件(Canvas / AssetPanel)若已处理 drop 并 preventDefault(),
 // 表明文件已导入,本组件跳过避免双重导入。子组件仍需 stopPropagation()
 // 防止事件冒泡到 window,这里 defaultPrevented 是双保险。
 if (e.defaultPrevented) {
 setDragCounter(0);
 return;
 }
 preventDefault(e);
 setDragCounter(0);
 const files = e.dataTransfer?.files ? Array.from(e.dataTransfer.files) : [];
 if (files.length === 0) return;

 const accepted: File[] = [];
 const rejected: string[] = [];
 for (const file of files) {
 if (isFileAccepted(file, accept)) {
 accepted.push(file);
 } else {
 rejected.push(`${file.name} (${file.type || 'unknown'})`);
 }
 }
 if (rejected.length > 0) {
 setRejectedFiles(rejected);
 // W21.6: 5 秒后自动清空拒绝提示,clear 旧 timer 避免重叠
 if (rejectTimerRef.current) clearTimeout(rejectTimerRef.current);
 rejectTimerRef.current = setTimeout(() => setRejectedFiles([]), 5000);
 }
 if (accepted.length > 0) {
 void importFiles(accepted);
 } else {
 setStatus('status.rejectedFiles', { count: rejected.length });
 setError(null);
 }
 };

 window.addEventListener('dragenter', onDragEnter);
 window.addEventListener('dragover', onDragOver);
 window.addEventListener('dragleave', onDragLeave);
 window.addEventListener('drop', onDrop);
 return () => {
 window.removeEventListener('dragenter', onDragEnter);
 window.removeEventListener('dragover', onDragOver);
 window.removeEventListener('dragleave', onDragLeave);
 window.removeEventListener('drop', onDrop);
 // W21.6: 清理 rejectedFiles 自动清除定时器
 if (rejectTimerRef.current) clearTimeout(rejectTimerRef.current);
 };
 }, [accept, importFiles, setStatus, setError]);

 const isDragging = dragCounter > 0;
 const hasRejections = rejectedFiles.length > 0;

 if (!isDragging && !hasRejections) return null;

 return (
 <div
 className={`pointer-events-none fixed inset-0 z-40 flex items-center justify-center p-8 ${className}`}
 role="alertdialog"
 aria-live="polite"
 >
 {/* 遮罩 */}
 <div className="absolute inset-0 bg-[var(--lokvis-primary)]/10/80 backdrop-blur-sm" />

 {/* 内容 */}
 <div
 className={`relative w-full max-w-md rounded-2xl border-2 border-dashed p-8 text-center bg-[var(--lokvis-surface)] shadow-[var(--lokvis-elevation-overlay)] ${
 hasRejections ? 'border-[var(--lokvis-danger)]' : 'border-[var(--lokvis-primary)]'
 }`}
 >
 {hasRejections ? (
 <>
 <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[var(--lokvis-danger)]/15">
 <Icon size={24} className="text-[var(--lokvis-danger)]" strokeWidth={2}>
 <circle cx="12" cy="12" r="10" />
 <line x1="15" y1="9" x2="9" y2="15" />
 <line x1="9" y1="9" x2="15" y2="15" />
 </Icon>
 </div>
 <p className="mt-3 text-sm font-semibold text-[var(--lokvis-danger)]">
 {t('dropzone.unsupported')}
 </p>
 <p className="mt-1.5 text-xs text-[var(--lokvis-danger)]/80">
 {rejectedFiles.join(', ')}
 </p>
 <p className="mt-2 text-[10px] text-[var(--lokvis-fg-muted)]">
 {t('dropzone.accepted', { accept: accept || t('dropzone.allFiles') })}
 </p>
 </>
 ) : (
 <>
 <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[var(--lokvis-primary)]/15">
 <Icon size={24} className="text-[var(--lokvis-primary)]" strokeWidth={1.5}>
 <path d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
 </Icon>
 </div>
 <p className="mt-3 text-sm font-semibold text-[var(--lokvis-primary)]">
 {t('dropzone.dropToImport')}
 </p>
 <p className="mt-1 text-xs text-[var(--lokvis-fg-muted)]">
 {t('dropzone.localHint')}
 </p>
 <p className="mt-2 text-[10px] text-[var(--lokvis-fg-subtle)]">
 {t('dropzone.accepted', { accept: accept || t('dropzone.allFiles') })}
 </p>
 </>
 )}
 </div>
 </div>
 );
}
