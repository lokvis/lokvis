/**
 * ParamForm - 能力参数表单
 *
 * 根据 Capability 的 params Schema 自动生成表单。
 * 紧凑行内布局，适配 Inspector 面板。
 */

import type { Capability, CapabilityParam } from '@lokvis/schema';

export interface ParamFormProps {
  capability: Capability;
  values: Record<string, unknown>;
  onChange: (values: Record<string, unknown>) => void;
}

export function ParamForm({ capability, values, onChange }: ParamFormProps) {
  const set = (name: string, value: unknown) => {
    onChange({ ...values, [name]: value });
  };

  if (capability.params.length === 0) {
    return (
      <p className="py-3 text-center text-[11px] text-zinc-400 italic">
        This capability has no configurable parameters.
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

const inputBase =
  'w-full rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-[11px] transition-colors focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400 dark:border-zinc-700 dark:bg-zinc-900';

function ParamField({
  param,
  value,
  onChange,
}: {
  param: CapabilityParam;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  if (param.type === 'boolean') {
    return (
      <label className="flex cursor-pointer items-center gap-2 rounded-md px-1 py-1 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
        <input
          type="checkbox"
          checked={Boolean(value ?? param.default)}
          onChange={(e) => onChange(e.target.checked)}
          className="h-3.5 w-3.5 rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500"
        />
        <span className="flex-1 text-[11px] text-zinc-700 dark:text-zinc-300">{param.name}</span>
        {param.description && (
          <span className="shrink-0 text-[10px] text-zinc-400">{param.description}</span>
        )}
      </label>
    );
  }

  if (param.type === 'enum' && param.values) {
    return (
      <div>
        <label className="mb-1 block text-[11px] font-medium text-zinc-600 dark:text-zinc-300">
          {param.name}
          {param.required && <span className="ml-0.5 text-red-500">*</span>}
        </label>
        <select
          value={(value as string) ?? (param.default as string) ?? ''}
          onChange={(e) => onChange(e.target.value)}
          className={inputBase}
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
        <label className="mb-1 block text-[11px] font-medium text-zinc-600 dark:text-zinc-300">
          {param.name}
        </label>
        <div className="flex gap-2">
          <input
            type="color"
            value={(value as string) ?? (param.default as string) ?? '#ffffff'}
            onChange={(e) => onChange(e.target.value)}
            className="h-7 w-7 shrink-0 cursor-pointer rounded border border-zinc-200 dark:border-zinc-700"
          />
          <input
            type="text"
            value={(value as string) ?? (param.default as string) ?? '#ffffff'}
            onChange={(e) => onChange(e.target.value)}
            className={inputBase}
          />
        </div>
      </div>
    );
  }

  if (param.type === 'number') {
    return (
      <div>
        <div className="mb-1 flex items-center justify-between">
          <label className="text-[11px] font-medium text-zinc-600 dark:text-zinc-300">
            {param.name}
            {param.required && <span className="ml-0.5 text-red-500">*</span>}
          </label>
          {(param.min !== undefined || param.max !== undefined) && (
            <span className="text-[10px] text-zinc-400">
              {param.min !== undefined ? param.min : '-'}
              {' — '}
              {param.max !== undefined ? param.max : '∞'}
            </span>
          )}
        </div>
        <input
          type="number"
          value={value === undefined ? (param.default as number | undefined) ?? '' : (value as number)}
          min={param.min}
          max={param.max}
          onChange={(e) => onChange(e.target.value === '' ? undefined : Number(e.target.value))}
          className={inputBase}
        />
      </div>
    );
  }

  // string / file / array / object → text input
  return (
    <div>
      <label className="mb-1 block text-[11px] font-medium text-zinc-600 dark:text-zinc-300">
        {param.name}
        {param.required && <span className="ml-0.5 text-red-500">*</span>}
        {param.description && (
          <span className="ml-1 font-normal text-zinc-400">{param.description}</span>
        )}
      </label>
      <input
        type="text"
        value={(value as string) ?? (param.default as string) ?? ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={param.type === 'file' ? 'data URL or path' : ''}
        className={inputBase}
      />
    </div>
  );
}
