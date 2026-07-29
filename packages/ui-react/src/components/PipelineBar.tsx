/**
 * PipelineBar - 工作流管道条
 *
 * 显示当前工作流的节点序列，支持选中、删除节点。
 * 位于 Canvas 下方、StatusBar 上方。
 */

import * as React from 'react';
import { FOCUS_RING, Icon } from '@lokvis/ui-core';
import { useWorkspaceStore } from '../store/index.js';
import { StatusDot } from './StatusDot.js';
import { useWorkspaceLang } from '../i18n/useWorkspaceLang.js';
import { pluralKey, useWorkspaceTranslations } from '../i18n/utils.js';

export interface PipelineBarProps {
 className?: string;
}

export function PipelineBar({ className = '' }: PipelineBarProps) {
 const lang = useWorkspaceLang();
 const t = useWorkspaceTranslations(lang);
 const nodes = useWorkspaceStore((s) => s.nodes);
 const selectedNodeId = useWorkspaceStore((s) => s.selectedNodeId);
 const selectNode = useWorkspaceStore((s) => s.selectNode);
 const removeNode = useWorkspaceStore((s) => s.removeNode);

 return (
 <div className={`flex h-10 shrink-0 items-center gap-2 border-t border-[var(--lokvis-border)] bg-[var(--lokvis-surface)] px-3 ${className}`}>
 <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--lokvis-fg-subtle)] shrink-0">
 {t('pipelineBar.title')}
 </span>

 {nodes.length === 0 ? (
 <span className="text-[11px] text-[var(--lokvis-fg-subtle)]">
 {t('pipelineBar.empty')}
 </span>
 ) : (
 <div className="flex flex-1 items-center gap-1 overflow-x-auto min-w-0">
 {/* Source indicator */}
 <div className="flex items-center gap-1 rounded-md bg-[var(--lokvis-surface-muted)] px-2 py-1 text-[11px] font-medium text-[var(--lokvis-fg-muted)] shrink-0">
 <Icon size={12}><path d="M12 4.5v15m7.5-7.5h-15" /></Icon>
 {t('pipelineBar.source')}
 </div>

 {/* Arrow */}
 <Icon size={12} className="shrink-0 text-[var(--lokvis-fg-subtle)]">
 <path d="m9 5 7 7-7 7" />
 </Icon>

 {/* Nodes */}
 {nodes.map((node, i) => {
 const selected = node.id === selectedNodeId;
 return (
 <React.Fragment key={node.id}>
 {/* D7: remove button 作为 node button 的兄弟而非子元素(HTML 规范禁止 button 嵌套) */}
 <div className="group flex shrink-0 items-center gap-0.5">
 <button
 type="button"
 onClick={() => selectNode(node.id)}
 onKeyDown={(e) => {
 // 键盘可达:Delete/Backspace 删除节点(与 WorkflowEditor 一致)
 if (e.key === 'Delete' || e.key === 'Backspace') {
 e.preventDefault();
 removeNode(node.id);
 }
 }}
 aria-label={t('pipelineBar.nodeAria', { capability: node.capability, position: i + 1 })}
 aria-pressed={selected}
 className={`flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-medium transition-all ${FOCUS_RING} ${
 selected
 ? 'bg-[var(--lokvis-primary)]/15 text-[var(--lokvis-primary)] ring-1 ring-[var(--lokvis-primary)]/50'
 : node.status === 'running'
 ? 'bg-[var(--lokvis-warning)]/15 text-[var(--lokvis-warning)]'
 : node.status === 'success'
 ? 'bg-[var(--lokvis-success)]/15 text-[var(--lokvis-success)]'
 : node.status === 'failed'
 ? 'bg-[var(--lokvis-danger)]/15 text-[var(--lokvis-danger)]'
 : 'bg-[var(--lokvis-surface-muted)] text-[var(--lokvis-fg-muted)] hover:bg-[var(--lokvis-border)]'
 }`}
 >
 <span className="font-mono">{node.capability}</span>
 <StatusDot status={node.status} />
 </button>
 <button
 type="button"
 onClick={() => removeNode(node.id)}
 className="rounded p-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lokvis-danger)] hover:bg-[var(--lokvis-danger)]/15 hover:text-[var(--lokvis-danger)]"
 aria-label={t('pipelineBar.removeStep')}
 >
 <Icon size={10} strokeWidth={3}><path d="M6 18L18 6M6 6l12 12" /></Icon>
 </button>
 </div>

 {/* Arrow between nodes */}
 {i < nodes.length - 1 && (
 <Icon size={12} className="shrink-0 text-[var(--lokvis-fg-subtle)]">
 <path d="m9 5 7 7-7 7" />
 </Icon>
 )}
 </React.Fragment>
 );
 })}

 {/* Output indicator */}
 <Icon size={12} className="shrink-0 text-[var(--lokvis-fg-subtle)]">
 <path d="m9 5 7 7-7 7" />
 </Icon>
 <div className="flex items-center gap-1 rounded-md bg-[var(--lokvis-surface-muted)] px-2 py-1 text-[11px] font-medium text-[var(--lokvis-fg-muted)] shrink-0">
 <Icon size={12}><path d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" /></Icon>
 {t('pipelineBar.output')}
 </div>
 </div>
 )}

 {/* Step count */}
 {nodes.length > 0 && (
 <span className="shrink-0 text-[11px] tabular-nums text-[var(--lokvis-fg-subtle)]">
 {t(pluralKey(lang, 'pipelineBar.stepCount', nodes.length), { count: nodes.length })}
 </span>
 )}
 </div>
 );
}
