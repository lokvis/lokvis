/**
 * WorkflowTemplates - 工作流模板选择器(W11.4)
 *
 * 展示 5 个内置模板,点击即应用到当前工作流(替换现有 nodes)。
 * 适合新用户快速上手,无需从零编排。
 *
 * 集成位置:
 * - 可作为独立组件渲染(如在 Inspector 底部或 Command Palette 中)
 * - Workspace 默认不渲染;由消费方按需挂载
 *
 * @module WorkflowTemplates
 */

import * as React from 'react';
import { ConfirmDialog, Icon } from '@lokvis/ui-core';
import { useWorkspaceStore } from '../store/index.js';
import { WORKFLOW_TEMPLATES, type WorkflowTemplate } from '../data/workflow-templates.js';
import type { Language } from '../i18n/config.js';
import { useWorkspaceLang } from '../i18n/useWorkspaceLang.js';
import { pluralKey, useWorkspaceTranslations } from '../i18n/utils.js';

export interface WorkflowTemplatesProps {
 className?: string;
 /** 应用模板前是否需要确认(当前有节点时默认 true) */
 confirmIfNotEmpty?: boolean;
 /** 模板应用后的回调 */
 onApply?: (template: WorkflowTemplate) => void;
 /**
  * 显式 UI 语言(本组件可独立于 Workspace 挂载,无 Provider 时用此
  * prop 指定语言;不传则回落到 html lang / URL 自动检测)。
  */
 locale?: Language;
}

export function WorkflowTemplates({
 className = '',
 confirmIfNotEmpty = true,
 onApply,
 locale,
}: WorkflowTemplatesProps) {
 const lang = useWorkspaceLang(locale);
 const t = useWorkspaceTranslations(lang);
 const loadWorkflowTemplate = useWorkspaceStore((s) => s.loadWorkflowTemplate);
 const nodes = useWorkspaceStore((s) => s.nodes);
 // 待确认应用的模板(非空工作流替换前需用户确认)
 const [pendingTpl, setPendingTpl] = React.useState<WorkflowTemplate | null>(null);

 const handleApply = (tpl: WorkflowTemplate) => {
 if (confirmIfNotEmpty && nodes.length > 0) {
 setPendingTpl(tpl);
 return;
 }
 applyTemplate(tpl);
 };

 const applyTemplate = (tpl: WorkflowTemplate) => {
 loadWorkflowTemplate(
 tpl.nodes.map((n) => ({ capability: n.capability, params: n.params }))
 );
 onApply?.(tpl);
 };

 return (
 <div
 className={`flex flex-col ${className}`}
 role="region"
 aria-label={t('workflowTemplates.templatesAria')}
 >
 <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--lokvis-border)]">
 <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--lokvis-fg-subtle)]">
 {t('workflowTemplates.title')}
 </span>
 <span className="text-[11px] text-[var(--lokvis-fg-subtle)]">{t('workflowTemplates.builtIn', { count: WORKFLOW_TEMPLATES.length })}</span>
 </div>
 <div className="grid grid-cols-1 gap-1.5 p-2">
 {WORKFLOW_TEMPLATES.map((tpl) => (
 <button
 key={tpl.id}
 type="button"
 onClick={() => handleApply(tpl)}
 className="group flex items-start gap-2 rounded-md border border-[var(--lokvis-border)] bg-[var(--lokvis-surface)] px-2.5 py-2 text-left transition-all hover:border-[var(--lokvis-primary)]/50 hover:bg-[var(--lokvis-primary)]/10"
 >
 <span className="mt-0.5 text-base leading-none">{tpl.icon}</span>
 <div className="flex-1 min-w-0">
 <div className="flex items-center justify-between gap-1">
 <span className="truncate text-[11px] font-medium text-[var(--lokvis-fg-muted)]">
 {t(tpl.nameKey)}
 </span>
 <span className="shrink-0 rounded bg-[var(--lokvis-surface-muted)] px-1 py-0.5 text-[11px] font-medium uppercase text-[var(--lokvis-fg-muted)]">
 {t(pluralKey(lang, 'workflowTemplates.stepCount', tpl.nodes.length), { count: tpl.nodes.length })}
 </span>
 </div>
 <p className="mt-0.5 truncate text-[11px] text-[var(--lokvis-fg-muted)]">
 {t(tpl.descriptionKey)}
 </p>
 {/* 节点链预览 */}
 <div className="mt-1 flex flex-wrap items-center gap-0.5">
 {tpl.nodes.map((n, i) => (
 <React.Fragment key={i}>
 {i > 0 && (
 <Icon size={8} className="text-[var(--lokvis-fg-subtle)]">
 <path d="m5 5 5 5-5 5" />
 </Icon>
 )}
 <code className="rounded bg-[var(--lokvis-surface-muted)] px-1 py-0.5 text-[11px] text-[var(--lokvis-fg-muted)]">
 {n.capability}
 </code>
 </React.Fragment>
 ))}
 </div>
 </div>
 </button>
 ))}
 </div>

 {/* 替换确认对话框(替代 window.confirm) */}
 <ConfirmDialog
 open={pendingTpl !== null}
 title={t('workflowTemplates.applyTitle')}
 message={
 pendingTpl
 ? t('workflowTemplates.applyMessage', { name: t(pendingTpl.nameKey), count: nodes.length })
 : ''
 }
 confirmText={t('workflowTemplates.replace')}
 variant="danger"
 onConfirm={() => {
 if (pendingTpl) applyTemplate(pendingTpl);
 setPendingTpl(null);
 }}
 onClose={() => setPendingTpl(null)}
 />
 </div>
 );
}
