/**
 * ParamForm - 能力参数表单
 *
 * 根据 Capability 的 params Schema 自动生成表单。
 * 紧凑行内布局，适配 Inspector 面板。
 */

import type { Capability, CapabilityParam } from '@lokvis/schema';
import { Input } from '@lokvis/ui-core';
import { resolveParamWidget } from './param-widgets.js';
import { useWorkspaceLang } from '../i18n/useWorkspaceLang.js';
import { useWorkspaceTranslations } from '../i18n/utils.js';

export interface ParamFormProps {
 capability: Capability;
 values: Record<string, unknown>;
 onChange: (values: Record<string, unknown>) => void;
}

export function ParamForm({ capability, values, onChange }: ParamFormProps) {
 const lang = useWorkspaceLang();
 const t = useWorkspaceTranslations(lang);
 const set = (name: string, value: unknown) => {
 onChange({ ...values, [name]: value });
 };

 if (capability.params.length === 0) {
 return (
 <p className="py-3 text-center text-[11px] text-[var(--lokvis-fg-subtle)] italic">
 {t('paramForm.noParams')}
 </p>
 );
 }

 return (
 <div className="space-y-2.5">
 {capability.params.map((p) => (
 <ParamField
 key={p.name}
 param={p}
 value={values[p.name]}
 onChange={(v) => set(p.name, v)}
 />
 ))}
 </div>
 );
}

// 仅用于 enum 的原生 <select>(Select 组件 API 不同,不在此迁移);
// 文本/数字输入已统一改用 <Input size="sm"> 组件,消除重复样式。
const selectBase =
 'w-full rounded-md border border-[var(--lokvis-border)] bg-[var(--lokvis-surface)] px-2.5 py-1.5 text-[11px] transition-colors hover:border-[var(--lokvis-border-strong)] focus:border-[var(--lokvis-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lokvis-primary)]/30 disabled:cursor-not-allowed disabled:opacity-50';

function ParamField({
 param,
 value,
 onChange,
}: {
 param: CapabilityParam;
 value: unknown;
 onChange: (value: unknown) => void;
}) {
 const lang = useWorkspaceLang();
 const t = useWorkspaceTranslations(lang);
 // widget 提示解析:自定义注册表优先(可覆盖内置),其次内置
 // slider/textarea/json;未命中回落到下方 type 默认控件。
 const Widget = resolveParamWidget(param);
 if (Widget) {
 return (
 <div>
 <label className="mb-1 block text-[11px] font-medium text-[var(--lokvis-fg-muted)]">
 {param.name}
 {param.required && <span className="ml-0.5 text-[var(--lokvis-danger)]">*</span>}
 {param.description && (
 <span className="ml-1 font-normal text-[var(--lokvis-fg-subtle)]">{param.description}</span>
 )}
 </label>
 <Widget param={param} value={value} onChange={onChange} />
 </div>
 );
 }

 if (param.type === 'boolean') {
 return (
 <label className="flex cursor-pointer items-center gap-2 rounded-md px-1 py-1 transition-colors hover:bg-[var(--lokvis-surface)]">
 <input
 type="checkbox"
 checked={Boolean(value ?? param.default)}
 onChange={(e) => onChange(e.target.checked)}
 className="h-3.5 w-3.5 rounded border-[var(--lokvis-border-strong)] text-[var(--lokvis-primary)] focus:ring-[var(--lokvis-primary)]"
 />
 <span className="flex-1 text-[11px] text-[var(--lokvis-fg-muted)]">{param.name}</span>
 {param.description && (
 <span className="shrink-0 text-[10px] text-[var(--lokvis-fg-subtle)]">{param.description}</span>
 )}
 </label>
 );
 }

 if (param.type === 'enum' && param.values) {
 return (
 <div>
 <label className="mb-1 block text-[11px] font-medium text-[var(--lokvis-fg-muted)]">
 {param.name}
 {param.required && <span className="ml-0.5 text-[var(--lokvis-danger)]">*</span>}
 </label>
 <select
 value={(value as string) ?? (param.default as string) ?? ''}
 onChange={(e) => onChange(e.target.value)}
 className={selectBase}
 >
 {param.values.map((v) => (
 <option key={v} value={v}>{v}</option>
 ))}
 </select>
 </div>
 );
 }

 if (param.type === 'color') {
 return (
 <div>
 <label className="mb-1 block text-[11px] font-medium text-[var(--lokvis-fg-muted)]">
 {param.name}
 </label>
 <div className="flex gap-2">
 <input
 type="color"
 value={(value as string) ?? (param.default as string) ?? '#ffffff'}
 onChange={(e) => onChange(e.target.value)}
 className="h-7 w-7 shrink-0 cursor-pointer rounded border border-[var(--lokvis-border)]"
 />
 <Input
 type="text"
 size="sm"
 value={(value as string) ?? (param.default as string) ?? '#ffffff'}
 onChange={(e) => onChange(e.target.value)}
 />
 </div>
 </div>
 );
 }

 if (param.type === 'number') {
 return (
 <div>
 <div className="mb-1 flex items-center justify-between">
 <label className="text-[11px] font-medium text-[var(--lokvis-fg-muted)]">
 {param.name}
 {param.required && <span className="ml-0.5 text-[var(--lokvis-danger)]">*</span>}
 </label>
 {(param.min !== undefined || param.max !== undefined) && (
 <span className="text-[10px] text-[var(--lokvis-fg-subtle)]">
 {param.min !== undefined ? param.min : '-'}
 {' — '}
 {param.max !== undefined ? param.max : '∞'}
 </span>
 )}
 </div>
 <Input
 type="number"
 size="sm"
 value={value === undefined ? (param.default as number | undefined) ?? '' : (value as number)}
 min={param.min}
 max={param.max}
 onChange={(e) => onChange(e.target.value === '' ? undefined : Number(e.target.value))}
 />
 </div>
 );
 }

 // string / file / array / object → text input
 return (
 <div>
 <label className="mb-1 block text-[11px] font-medium text-[var(--lokvis-fg-muted)]">
 {param.name}
 {param.required && <span className="ml-0.5 text-[var(--lokvis-danger)]">*</span>}
 {param.description && (
 <span className="ml-1 font-normal text-[var(--lokvis-fg-subtle)]">{param.description}</span>
 )}
 </label>
 <Input
 type="text"
 size="sm"
 value={(value as string) ?? (param.default as string) ?? ''}
 onChange={(e) => onChange(e.target.value)}
 placeholder={param.type === 'file' ? t('paramForm.filePlaceholder') : ''}
 />
 </div>
 );
}
