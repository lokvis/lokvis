/**
 * ParamForm - 能力参数表单
 *
 * 根据 Capability 的 params Schema 自动生成表单。
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
    return <p className="text-xs text-zinc-400">No parameters</p>;
  }

  return (
    <div className="space-y-3">
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

function ParamField({
  param,
  value,
  onChange,
}: {
  param: CapabilityParam;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  const label = (
    <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-300">
      {param.name}
      {param.required && <span className="ml-1 text-red-500">*</span>}
      {param.description && (
        <span className="ml-1 text-zinc-400">— {param.description}</span>
      )}
    </label>
  );

  if (param.type === 'enum' && param.values) {
    return (
      <div>
        {label}
        <select
          value={(value as string) ?? (param.default as string) ?? ''}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-md border border-zinc-200 bg-transparent px-2 py-1 text-xs focus:border-indigo-500 focus:outline-none dark:border-zinc-700"
        >
          {param.values.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
      </div>
    );
  }

  if (param.type === 'boolean') {
    return (
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={Boolean(value ?? param.default)}
          onChange={(e) => onChange(e.target.checked)}
          className="h-3.5 w-3.5 rounded border-zinc-300"
        />
        <span className="text-xs text-zinc-600 dark:text-zinc-300">{param.name}</span>
      </div>
    );
  }

  if (param.type === 'color') {
    return (
      <div>
        {label}
        <input
          type="color"
          value={(value as string) ?? (param.default as string) ?? '#ffffff'}
          onChange={(e) => onChange(e.target.value)}
          className="h-8 w-full rounded border border-zinc-200 dark:border-zinc-700"
        />
      </div>
    );
  }

  if (param.type === 'number') {
    return (
      <div>
        {label}
        <input
          type="number"
          value={value === undefined ? (param.default as number | undefined) ?? '' : (value as number)}
          min={param.min}
          max={param.max}
          onChange={(e) => onChange(e.target.value === '' ? undefined : Number(e.target.value))}
          className="w-full rounded-md border border-zinc-200 bg-transparent px-2 py-1 text-xs focus:border-indigo-500 focus:outline-none dark:border-zinc-700"
        />
      </div>
    );
  }

  // string / file / array / object → text input
  return (
    <div>
      {label}
      <input
        type="text"
        value={(value as string) ?? (param.default as string) ?? ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={param.type === 'file' ? 'data URL or path' : ''}
        className="w-full rounded-md border border-zinc-200 bg-transparent px-2 py-1 text-xs focus:border-indigo-500 focus:outline-none dark:border-zinc-700"
      />
    </div>
  );
}
