/**
 * Inspector - 右侧面板
 *
 * 上半部分：当前选中节点的参数配置（Configure）
 * 下半部分：可用 Capabilities 列表（点击添加到工作流）
 */

import * as React from 'react';
import { Icon, Input } from '@lokvis/ui-core';
import { useWorkspaceStore } from '../store/index.js';
import { filterCapabilities, capabilityLabel, capabilityGroup } from '../utils.js';
import { ParamForm } from './ParamForm.js';
import { ExifPanel } from './ExifPanel.js';
import { useWorkspaceLang } from '../i18n/useWorkspaceLang.js';
import { useWorkspaceTranslations } from '../i18n/utils.js';

export interface InspectorProps {
 className?: string;
}

export function Inspector({ className = '' }: InspectorProps) {
 const lang = useWorkspaceLang();
 const t = useWorkspaceTranslations(lang);
 const capabilities = useWorkspaceStore((s) => s.capabilities);
 const nodes = useWorkspaceStore((s) => s.nodes);
 const selectedNodeId = useWorkspaceStore((s) => s.selectedNodeId);
 const capabilityMap = useWorkspaceStore((s) => s.capabilityMap);
 const stubCapabilities = useWorkspaceStore((s) => s.stubCapabilities);
 const addNode = useWorkspaceStore((s) => s.addNode);
 const updateNodeParams = useWorkspaceStore((s) => s.updateNodeParams);

 const selectedNode = nodes.find((n) => n.id === selectedNodeId);
 const [filter, setFilter] = React.useState('');
 const [configureOpen, setConfigureOpen] = React.useState(true);

 const filtered = filterCapabilities(capabilities, filter);

 // 按展示分组(presentation group 优先,回退 name domain 前缀)
 const grouped = React.useMemo(() => {
 const map = new Map<string, typeof filtered>();
 for (const cap of filtered) {
 const group = capabilityGroup(cap);
 if (!map.has(group)) map.set(group, []);
 map.get(group)!.push(cap);
 }
 return map;
 }, [filtered]);

 const showConfigure = selectedNode && capabilityMap[selectedNode.capability];

 return (
 <aside
 className={`flex w-72 shrink-0 flex-col border-l border-[var(--lokvis-border)] ${className}`}
 >
 {/* EXIF panel (selected image asset only, hides automatically for non-image) */}
 <ExifPanel />

 {/* Configure section (when a node is selected) */}
 {showConfigure && (
 <div className="shrink-0 border-b border-[var(--lokvis-border)]">
 <button
 type="button"
 onClick={() => setConfigureOpen(!configureOpen)}
 aria-expanded={configureOpen}
 aria-controls={`configure-panel-${selectedNode.id}`}
 className="flex w-full items-center justify-between px-3 h-[var(--lokvis-panel-header-h)] text-left transition-colors hover:bg-[var(--lokvis-surface)]"
 >
 <div className="flex items-center gap-2">
 <Icon size={12} className={`text-[var(--lokvis-fg-subtle)] transition-transform ${configureOpen ? 'rotate-90' : ''}`}><path d="m9 5 7 7-7 7" /></Icon>
 <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--lokvis-fg-subtle)]">{t('inspector.configure')}</span>
 </div>
 <span className="font-mono text-[10px] text-[var(--lokvis-primary)] bg-[var(--lokvis-primary)]/10 px-1.5 py-0.5 rounded">
 {selectedNode.capability}
 </span>
 </button>
 {configureOpen && (
 <div id={`configure-panel-${selectedNode.id}`} className="px-3 pb-3 max-h-60 overflow-y-auto">
 <ParamForm
 capability={capabilityMap[selectedNode.capability]!}
 values={selectedNode.params}
 onChange={(params) => updateNodeParams(selectedNode.id, params)}
 />
 </div>
 )}
 </div>
 )}

 {/* Capabilities section */}
 <div className="flex flex-1 flex-col overflow-hidden">
 <div className="flex items-center justify-between px-3 h-[var(--lokvis-panel-header-h)] shrink-0 border-b border-[var(--lokvis-border)]">
 <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--lokvis-fg-subtle)]">
 {t('inspector.capabilities')}
 </span>
 <span className="text-[11px] tabular-nums text-[var(--lokvis-fg-subtle)]">{filtered.length}</span>
 </div>

 {/* Search */}
 <div className="px-2 py-2 border-b border-[var(--lokvis-border)]">
 <Input
 size="sm"
 placeholder={t('inspector.searchPlaceholder')}
 value={filter}
 onChange={(e) => setFilter(e.target.value)}
 leadingIcon={
 <Icon size={12}><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></Icon>
 }
 />
 </div>

 {/* Capability list */}
 <div className="flex-1 overflow-y-auto p-2">
 {capabilities.length === 0 ? (
 <div className="px-2 py-8 text-center">
 <p className="text-[11px] text-[var(--lokvis-fg-subtle)]">{t('inspector.empty')}</p>
 <p className="mt-1 text-[10px] text-[var(--lokvis-fg-muted)]">{t('inspector.emptyHint')}</p>
 </div>
 ) : filtered.length === 0 ? (
 <p className="px-2 py-4 text-[11px] text-[var(--lokvis-fg-subtle)]">{t('inspector.noMatch')}</p>
 ) : (
 <div className="space-y-3">
 {Array.from(grouped.entries()).map(([group, caps]) => (
 <div key={group}>
 <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--lokvis-fg-subtle)]">
 {group}
 </div>
 <ul className="space-y-0.5">
 {caps.map((cap) => {
 const isInPipeline = nodes.some((n) => n.capability === cap.name);
 // A7: stub-only 能力显示 "Coming Soon" 标记(无可用引擎)
 const isStubOnly = stubCapabilities.has(cap.name);
 return (
 <li key={cap.name}>
 <button
 type="button"
 onClick={() => addNode(cap.name)}
 title={isStubOnly ? t('inspector.comingSoon') : undefined}
 className={`group w-full rounded-md px-2 py-1.5 text-left transition-all ${
 isInPipeline
 ? 'bg-[var(--lokvis-primary)]/5 ring-1 ring-[var(--lokvis-primary)]/40'
 : 'hover:bg-[var(--lokvis-surface)]'
 }`}
 >
 <div className="flex items-center justify-between gap-2">
 <span className={`truncate text-[11px] font-medium ${cap.label ? '' : 'font-mono '} ${isStubOnly ? 'text-[var(--lokvis-fg-muted)]' : ''}`}>
 {cap.icon ? <span aria-hidden="true">{cap.icon} </span> : null}
 {capabilityLabel(cap)}
 </span>
 {isStubOnly ? (
 <span className="shrink-0 rounded px-1 py-0.5 text-[9px] font-medium uppercase bg-[var(--lokvis-warning)]/15 text-[var(--lokvis-warning)]">
 {t('inspector.soon')}
 </span>
 ) : (
 <span className={`shrink-0 rounded px-1 py-0.5 text-[9px] font-medium uppercase ${
 cap.performance === 'fast'
 ? 'bg-[var(--lokvis-success)]/15 text-[var(--lokvis-success)]'
 : cap.performance === 'medium'
 ? 'bg-[var(--lokvis-warning)]/15 text-[var(--lokvis-warning)]'
 : 'bg-[var(--lokvis-surface-muted)] text-[var(--lokvis-fg-muted)]'
 }`}>
 {cap.performance}
 </span>
 )}
 </div>
 <p className="mt-0.5 truncate text-[10px] text-[var(--lokvis-fg-muted)]">{cap.description}</p>
 </button>
 </li>
 );
 })}
 </ul>
 </div>
 ))}
 </div>
 )}
 </div>
 </div>
 </aside>
 );
}
