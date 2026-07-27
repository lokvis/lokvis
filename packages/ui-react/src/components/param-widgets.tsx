/**
 * ParamForm Widget 注册表与内置 widget(UI 扩展点)
 *
 * CapabilityParam.widget 是字符串提示,ParamField 按以下顺序解析:
 * 1. 自定义注册表(registerParamWidget,优先 —— 三方可覆盖内置)
 * 2. 内置 widget(slider / textarea / json)
 * 3. 未命中 → 回落到 type 默认控件(ParamField 内)
 *
 * Widget 只渲染控件本身;label(name / required / description)
 * 由 ParamField 统一渲染,保证视觉一致。
 */
import * as React from 'react';
import type { CapabilityParam } from '@lokvis/schema';

/** Widget 接收的 props(控件本体,不含 label) */
export interface ParamWidgetProps {
 /** 参数定义(含 type / min / max / values / default 等) */
 param: CapabilityParam;
 /** 当前值(可能为 undefined,widget 自行回落 param.default) */
 value: unknown;
 /** 值变更回调 */
 onChange: (value: unknown) => void;
}

export type ParamWidget = React.ComponentType<ParamWidgetProps>;

/** 模块级自定义 widget 注册表(与 Workspace store 同为单例语义) */
const widgets = new Map<string, ParamWidget>();

/**
 * 注册自定义参数 widget。
 *
 * 同名覆盖(支持覆盖内置 slider/textarea/json)。
 * @returns 反注册函数(仅移除自己注册的组件)
 */
export function registerParamWidget(name: string, widget: ParamWidget): () => void {
  widgets.set(name, widget);
  return () => {
    if (widgets.get(name) === widget) widgets.delete(name);
  };
}

/** 按标识解析 widget;未注册返回 undefined */
export function getParamWidget(name: string): ParamWidget | undefined {
  return widgets.get(name);
}

/** 清空注册表(仅供测试使用) */
export function clearParamWidgets(): void {
  widgets.clear();
}

// ─── 内置 widget ──────────────────────────────────────────────

/** number 滑杆(显示当前值;min/max 取自参数定义,缺省 0-100) */
export function SliderWidget({ param, value, onChange }: ParamWidgetProps) {
  const min = param.min ?? 0;
  const max = param.max ?? 100;
  const current = typeof value === 'number' ? value : ((param.default as number) ?? min);
  return (
    <div className="flex items-center gap-2">
      <input
        type="range"
        min={min}
        max={max}
        value={current}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-[var(--lokvis-border)] accent-[var(--lokvis-primary)]"
        aria-label={param.name}
      />
      <span className="w-10 shrink-0 text-right text-[10px] tabular-nums text-[var(--lokvis-fg-muted)]">
        {current}
      </span>
    </div>
  );
}

/** 多行文本(string) */
export function TextareaWidget({ param, value, onChange }: ParamWidgetProps) {
  return (
    <textarea
      value={(value as string) ?? (param.default as string) ?? ''}
      onChange={(e) => onChange(e.target.value)}
      rows={3}
      className="w-full resize-y rounded-md border border-[var(--lokvis-border)] bg-[var(--lokvis-surface)] px-2.5 py-1.5 text-[11px] transition-colors hover:border-[var(--lokvis-border-strong)] focus:border-[var(--lokvis-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lokvis-primary)]/30"
      aria-label={param.name}
    />
  );
}

/**
 * JSON 编辑器(array / object)。
 *
 * 本地持有文本态:输入合法 JSON 时同步到 onChange;非法时保留文本
 * 并标红边框,不向工作流传播坏值。外部 value 变化时重新序列化。
 */
/** 把参数值序列化为 JSON 文本(undefined/null 回落 default;default 缺失时为空串) */
function serializeJsonValue(v: unknown, fallback: unknown): string {
  if (v === undefined || v === null) {
    return fallback === undefined || fallback === null
      ? ''
      : JSON.stringify(fallback, null, 2);
  }
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return String(v);
  }
}

export function JsonWidget({ param, value, onChange }: ParamWidgetProps) {
  const paramDefault = param.default;
  const [text, setText] = React.useState(() => serializeJsonValue(value, paramDefault));
  const [invalid, setInvalid] = React.useState(false);

  // 外部 value 变化(如节点切换)时重新序列化
  React.useEffect(() => {
    setText(serializeJsonValue(value, paramDefault));
    setInvalid(false);
  }, [value, paramDefault]);

  const handleText = (next: string) => {
    setText(next);
    if (next.trim() === '') {
      setInvalid(false);
      onChange(undefined);
      return;
    }
    try {
      onChange(JSON.parse(next));
      setInvalid(false);
    } catch {
      setInvalid(true); // 非法 JSON:保留文本,不传播
    }
  };

  return (
    <textarea
      value={text}
      onChange={(e) => handleText(e.target.value)}
      rows={4}
      spellCheck={false}
      className={`w-full resize-y rounded-md border bg-[var(--lokvis-surface)] px-2.5 py-1.5 font-mono text-[10px] transition-colors focus-visible:outline-none focus-visible:ring-2 ${
        invalid
          ? 'border-[var(--lokvis-danger)] focus-visible:ring-[var(--lokvis-danger)]/30'
          : 'border-[var(--lokvis-border)] hover:border-[var(--lokvis-border-strong)] focus:border-[var(--lokvis-primary)] focus-visible:ring-[var(--lokvis-primary)]/30'
      }`}
      aria-label={param.name}
      aria-invalid={invalid}
    />
  );
}

/** 内置 widget 表 */
export const BUILT_IN_PARAM_WIDGETS: Record<string, ParamWidget> = {
  slider: SliderWidget,
  textarea: TextareaWidget,
  json: JsonWidget,
};

/**
 * 解析参数的 widget:自定义注册表优先(可覆盖内置),其次内置表。
 * 未命中返回 undefined,ParamField 回落到 type 默认控件。
 */
export function resolveParamWidget(param: CapabilityParam): ParamWidget | undefined {
  if (!param.widget) return undefined;
  return widgets.get(param.widget) ?? BUILT_IN_PARAM_WIDGETS[param.widget];
}
