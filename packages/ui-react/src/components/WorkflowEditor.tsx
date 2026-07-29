/**
 * WorkflowEditor - 拖拽式工作流编辑器(W10.4)
 *
 * 增强 PipelineBar,提供节点拖拽重排能力:
 * - 拖拽节点到任意位置重排线性链
 * - 拖拽时显示插入指示器
 * - 键盘支持:选中节点后 ← → 移动(无障碍)
 * - 节点数上限 MAX_WORKFLOW_STEPS=5(M1 MVP 约束,UI 层常量)
 *
 * 与 PipelineBar 区别:
 * - PipelineBar:只读 + 选中/删除(快速预览)
 * - WorkflowEditor:可编辑 + 拖拽重排(编辑模式)
 *
 * 使用原生 HTML5 Drag and Drop API,无额外依赖。
 * 触摸设备降级为按钮上下移动(HTML5 DnD 在移动端支持不佳)。
 *
 * @module WorkflowEditor
 */

import * as React from 'react';
import { ConfirmDialog, Icon, Input } from '@lokvis/ui-core';
import type { Capability } from '@lokvis/schema';
import { useWorkspaceStore, MAX_WORKFLOW_STEPS } from '../store/index.js';
import { filterCapabilities, capabilityLabel } from '../utils.js';
import { StatusDot } from './StatusDot.js';
import { useWorkspaceLang } from '../i18n/useWorkspaceLang.js';
import { useWorkspaceTranslations } from '../i18n/utils.js';

export interface WorkflowEditorProps {
 className?: string;
}

export function WorkflowEditor({ className = '' }: WorkflowEditorProps) {
 const lang = useWorkspaceLang();
 const t = useWorkspaceTranslations(lang);
 const nodes = useWorkspaceStore((s) => s.nodes);
 const selectedNodeId = useWorkspaceStore((s) => s.selectedNodeId);
 const selectNode = useWorkspaceStore((s) => s.selectNode);
 const removeNode = useWorkspaceStore((s) => s.removeNode);
 const moveNode = useWorkspaceStore((s) => s.moveNode);
 const insertNodeAt = useWorkspaceStore((s) => s.insertNodeAt);
 const capabilities = useWorkspaceStore((s) => s.capabilities);
 const stubCapabilities = useWorkspaceStore((s) => s.stubCapabilities);
 const clearWorkflow = useWorkspaceStore((s) => s.clearWorkflow);

 // 拖拽状态:被拖拽的节点索引 + 当前 hover 的插入位置
 const [dragIndex, setDragIndex] = React.useState<number | null>(null);
 const [hoverIndex, setHoverIndex] = React.useState<number | null>(null);
 // 清空确认对话框
 const [clearOpen, setClearOpen] = React.useState(false);

 const handleDragStart = (e: React.DragEvent, index: number) => {
 setDragIndex(index);
 e.dataTransfer.effectAllowed = 'move';
 // Firefox 需要设置 data 才能触发 dragstart
 e.dataTransfer.setData('text/plain', String(index));
 };

 const handleDragOver = (e: React.DragEvent, index: number) => {
 e.preventDefault();
 e.dataTransfer.dropEffect = 'move';
 if (dragIndex !== null && dragIndex !== index) {
 setHoverIndex(index);
 }
 };

 const handleDragLeave = () => {
 // 不立即清空 hoverIndex,因为 dragleave 在子元素间会误触发
 // 由 handleDrop / handleDragEnd 统一清空
 };

 const handleDrop = (e: React.DragEvent, index: number) => {
 e.preventDefault();
 if (dragIndex !== null && dragIndex !== index) {
 moveNode(dragIndex, index);
 }
 setDragIndex(null);
 setHoverIndex(null);
 };

 const handleDragEnd = () => {
 setDragIndex(null);
 setHoverIndex(null);
 };

 // 键盘支持:选中节点后用 ← → 移动。传 node.id 而非 index 避免异步操作后 stale index
 const handleKeyDown = (e: React.KeyboardEvent, nodeId: string, index: number) => {
 if (e.key === 'ArrowLeft' && index > 0) {
 e.preventDefault();
 moveNode(index, index - 1);
 } else if (e.key === 'ArrowRight' && index < nodes.length - 1) {
 e.preventDefault();
 moveNode(index, index + 1);
 } else if (e.key === 'Delete' || e.key === 'Backspace') {
 e.preventDefault();
 removeNode(nodeId);
 }
 };

 const canAddMore = nodes.length < MAX_WORKFLOW_STEPS;

 return (
 <div
 className={`flex flex-col border-b border-[var(--lokvis-border)] bg-[var(--lokvis-surface)] ${className}`}
 role="region"
 aria-label={t('workflowEditor.editorAria')}
 >
 {/* 顶部:标题 + 步数 + 清空 */}
 <div className="flex h-9 shrink-0 items-center justify-between border-b border-[var(--lokvis-border)] px-3">
 <div className="flex items-center gap-2">
 <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--lokvis-fg-subtle)]">
 {t('workflowEditor.title')}
 </span>
 <span
 className={`rounded px-1.5 py-0.5 text-[11px] tabular-nums ${
 canAddMore
 ? 'bg-[var(--lokvis-surface-muted)] text-[var(--lokvis-fg-muted)]'
 : 'bg-[var(--lokvis-warning)]/15 text-[var(--lokvis-warning)]'
 }`}
 >
 {nodes.length}/{MAX_WORKFLOW_STEPS}
 </span>
 </div>
 {nodes.length > 0 && (
 <button
 type="button"
 onClick={() => setClearOpen(true)}
 className="text-[11px] text-[var(--lokvis-fg-subtle)] transition-colors hover:text-[var(--lokvis-danger)]"
 aria-label={t('workflowEditor.clearAria')}
 >
 {t('workflowEditor.clear')}
 </button>
 )}
 </div>

 {/* 节点链 */}
 <div className="flex min-h-[3rem] items-center gap-1 overflow-x-auto px-3 py-2">
 {nodes.length === 0 ? (
 <div className="flex flex-1 items-center justify-center py-2 text-center">
 <p className="text-[11px] text-[var(--lokvis-fg-subtle)]">
 {t('workflowEditor.empty')}
 </p>
 </div>
 ) : (
 <>
 {/* Source indicator */}
 <div className="flex shrink-0 items-center gap-1 rounded-md bg-[var(--lokvis-surface-muted)] px-2 py-1 text-[11px] font-medium text-[var(--lokvis-fg-muted)]">
 <Icon size={12}><path d="M12 4.5v15m7.5-7.5h-15" /></Icon>
 {t('workflowEditor.source')}
 </div>

 {/* W11.1: 节点之间可插入的连接器(+ 按钮) */}
 <InsertConnector
 index={0}
 capabilities={capabilities}
 stubCapabilities={stubCapabilities}
 onInsert={insertNodeAt}
 disabled={nodes.length >= MAX_WORKFLOW_STEPS}
 />

 {/* 节点 */}
 {nodes.map((node, i) => {
 const selected = node.id === selectedNodeId;
 const isDragging = dragIndex === i;
 const isHoverTarget = hoverIndex === i && dragIndex !== null && dragIndex !== i;
 return (
 <React.Fragment key={node.id}>
 {/* D7: remove button 作为 node button 的兄弟而非子元素(HTML 规范禁止 button 嵌套) */}
 <div className="group relative flex shrink-0 items-center">
 <button
 type="button"
 draggable
 onDragStart={(e) => handleDragStart(e, i)}
 onDragOver={(e) => handleDragOver(e, i)}
 onDragLeave={handleDragLeave}
 onDrop={(e) => handleDrop(e, i)}
 onDragEnd={handleDragEnd}
 onClick={() => selectNode(node.id)}
 onKeyDown={(e) => handleKeyDown(e, node.id, i)}
 aria-label={t('workflowEditor.nodeAria', { capability: node.capability, position: i + 1 })}
 className={`flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11px] font-medium transition-all ${
 isDragging
 ? 'opacity-40'
 : isHoverTarget
 ? 'ring-2 ring-[var(--lokvis-primary)] ring-offset-1'
 : selected
 ? 'bg-[var(--lokvis-primary)]/15 text-[var(--lokvis-primary)] ring-1 ring-[var(--lokvis-primary)]/50'
 : node.status === 'running'
 ? 'bg-[var(--lokvis-warning)]/15 text-[var(--lokvis-warning)]'
 : node.status === 'success'
 ? 'bg-[var(--lokvis-success)]/15 text-[var(--lokvis-success)]'
 : node.status === 'failed'
 ? 'bg-[var(--lokvis-danger)]/15 text-[var(--lokvis-danger)]'
 : 'bg-[var(--lokvis-surface-muted)] text-[var(--lokvis-fg-muted)] hover:bg-[var(--lokvis-border)]'
 } cursor-grab active:cursor-grabbing`}
 >
 {/* 步骤序号 */}
 <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[var(--lokvis-fg)]/5 text-[11px] tabular-nums">
 {i + 1}
 </span>
 <span className="font-mono">{node.capability}</span>
 <StatusDot status={node.status} />
 </button>
 {/* 删除按钮:兄弟 button(position absolute 浮在节点右上角),group-hover 显示 */}
 <button
 type="button"
 onClick={() => removeNode(node.id)}
 aria-label={t('workflowEditor.deleteNode')}
 tabIndex={-1}
 className="absolute -right-1 -top-1 rounded p-0.5 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-[var(--lokvis-danger)]/15 hover:text-[var(--lokvis-danger)]"
 >
 <Icon size={10} strokeWidth={3}><path d="M6 18L18 6M6 6l12 12" /></Icon>
 </button>
 </div>

 {/* W11.1: 每个节点后的插入连接器(最后一个用于追加到 Output 前) */}
 <InsertConnector
 index={i + 1}
 capabilities={capabilities}
 stubCapabilities={stubCapabilities}
 onInsert={insertNodeAt}
 disabled={nodes.length >= MAX_WORKFLOW_STEPS}
 />
 </React.Fragment>
 );
 })}

 {/* Output indicator */}
 {nodes.length > 0 && (
 <div className="flex shrink-0 items-center gap-1 rounded-md bg-[var(--lokvis-surface-muted)] px-2 py-1 text-[11px] font-medium text-[var(--lokvis-fg-muted)]">
 <Icon size={12}><path d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" /></Icon>
 {t('workflowEditor.output')}
 </div>
 )}
 </>
 )}
 </div>

 {/* 提示行 */}
 {nodes.length > 0 && (
 <div className="flex shrink-0 items-center gap-2 border-t border-[var(--lokvis-border)] px-3 py-1 text-[11px] text-[var(--lokvis-fg-subtle)]">
 <Icon size={10}><path d="M13 5.5a1 1 0 1 1 2 0 1-1 0 0 0-.5.86L16.5 9l1.5-.5a1 1 0 1 1 0 2l-1.5-.5-1 1.5a1 1 0 1 1-2 0l1-1.5-1-1.5a1 1 0 0 1 0-2z" /></Icon>
 <span>{t('workflowEditor.hint')}</span>
 </div>
 )}

 {/* 清空确认对话框(替代 window.confirm) */}
 <ConfirmDialog
 open={clearOpen}
 title={t('workflowEditor.confirmClearTitle')}
 message={t('workflowEditor.confirmClearMessage')}
 confirmText={t('workflowEditor.confirmClearConfirm')}
 variant="danger"
 onConfirm={() => {
 clearWorkflow();
 setClearOpen(false);
 }}
 onClose={() => setClearOpen(false)}
 />
 </div>
 );
}

/**
 * InsertConnector - 节点之间的连接器 + 插入按钮(W11.1)
 *
 * 默认显示箭头;hover 时变为 + 按钮,点击弹出 capability 选择菜单。
 * 选择后调用 onInsert(index, capability)。
 */
function InsertConnector({
 index,
 capabilities,
 stubCapabilities,
 onInsert,
 disabled,
}: {
 index: number;
 capabilities: Capability[];
 stubCapabilities: Set<string>;
 onInsert: (index: number, capability: string) => void;
 disabled?: boolean;
}) {
 const lang = useWorkspaceLang();
 const t = useWorkspaceTranslations(lang);
 const [open, setOpen] = React.useState(false);
 const [filter, setFilter] = React.useState('');
 const ref = React.useRef<HTMLDivElement>(null);

 // 点击外部关闭菜单
 React.useEffect(() => {
 if (!open) return;
 const handler = (e: MouseEvent) => {
 // 用 instanceof guard 替代 as Node 断言:运行时安全 + 类型安全
 if (!(e.target instanceof Node)) return;
 if (ref.current && !ref.current.contains(e.target)) {
 setOpen(false);
 setFilter('');
 }
 };
 document.addEventListener('mousedown', handler);
 return () => document.removeEventListener('mousedown', handler);
 }, [open]);

 const filtered = React.useMemo(
 () => filterCapabilities(capabilities, filter),
 [capabilities, filter]
 );

 const handleSelect = (capName: string) => {
 onInsert(index, capName);
 setOpen(false);
 setFilter('');
 };

 if (disabled) {
 // 5 步上限时只显示箭头,不显示 +
 return (
 <Icon size={12} className="shrink-0 text-[var(--lokvis-fg-subtle)]">
 <path d="m9 5 7 7-7 7" />
 </Icon>
 );
 }

 return (
 <div ref={ref} className="relative flex shrink-0 items-center">
 {/* 箭头 / + 按钮切换 */}
 <button
 type="button"
 onClick={() => setOpen(!open)}
 aria-label={t('workflowEditor.insertNodeAria', { position: index + 1 })}
 title={t('workflowEditor.insertNode')}
 className="group flex h-5 w-5 items-center justify-center rounded text-[var(--lokvis-fg-subtle)] transition-colors hover:bg-[var(--lokvis-primary)]/15 hover:text-[var(--lokvis-primary)]"
 >
 <Icon size={12} className="group-hover:hidden">
 <path d="m9 5 7 7-7 7" />
 </Icon>
 <Icon size={12} className="hidden group-hover:block" strokeWidth={2.5}>
 <path d="M12 5v14M5 12h14" />
 </Icon>
 </button>

 {/* 弹出菜单 */}
 {open && (
 <div className="absolute top-full left-1/2 z-50 mt-1 w-56 -translate-x-1/2 rounded-lg border border-[var(--lokvis-border)] bg-[var(--lokvis-surface)] shadow-[var(--lokvis-elevation-2)]">
 {/* 搜索 */}
 <div className="border-b border-[var(--lokvis-border)] p-1.5">
 <Input
 type="text"
 size="sm"
 autoFocus
 placeholder={t('workflowEditor.searchPlaceholder')}
 value={filter}
 onChange={(e) => setFilter(e.target.value)}
 />
 </div>
 {/* 列表 */}
 <div className="max-h-48 overflow-y-auto p-1">
 {filtered.length === 0 ? (
 <p className="px-2 py-2 text-center text-[11px] text-[var(--lokvis-fg-subtle)]">{t('workflowEditor.noMatch')}</p>
 ) : (
 filtered.map((cap) => {
 // A7: stub-only 能力显示 "Coming Soon" 标记
 const isStubOnly = stubCapabilities.has(cap.name);
 return (
 <button
 key={cap.name}
 type="button"
 onClick={() => handleSelect(cap.name)}
 title={isStubOnly ? t('workflowEditor.comingSoon') : undefined}
 className="block w-full rounded px-2 py-1 text-left transition-colors hover:bg-[var(--lokvis-primary)]/10"
 >
 <span className="flex items-center justify-between gap-1.5">
 <span className={`block truncate text-[11px] font-medium text-[var(--lokvis-fg-muted)] ${cap.label ? '' : 'font-mono'}`}>
 {cap.icon ? <span aria-hidden="true">{cap.icon} </span> : null}
 {capabilityLabel(cap)}
 </span>
 {isStubOnly && (
 <span className="shrink-0 rounded px-1 py-0.5 text-[8px] font-medium uppercase bg-[var(--lokvis-warning)]/15 text-[var(--lokvis-warning)]">
 {t('workflowEditor.soon')}
 </span>
 )}
 </span>
 <span className="block truncate text-[11px] text-[var(--lokvis-fg-muted)]">
 {cap.description}
 </span>
 </button>
 );
 })
 )}
 </div>
 </div>
 )}
 </div>
 );
}

