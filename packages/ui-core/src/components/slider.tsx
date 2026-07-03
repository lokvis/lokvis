import * as React from 'react';

export interface SliderProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  /** 显示当前值与范围标签(渲染在滑块上方) */
  showValue?: boolean;
  /** 自定义值格式化(如百分比 / 单位) */
  format?: (value: number) => string;
}

/**
 * Slider - 数值滑块。
 *
 * 基于 `<input type="range">`,样式经 `accent-color` 对齐设计主色。
 * 受控用法:传 `value` + `onChange`;非受控用法:传 `defaultValue`。
 */
export function Slider({
  showValue = false,
  format,
  className = '',
  value,
  defaultValue,
  min = 0,
  max = 100,
  step = 1,
  ...props
}: SliderProps) {
  const current = value ?? defaultValue ?? 0;
  const display = format ? format(Number(current)) : String(current);

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {showValue && (
        <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
          <span>{min}</span>
          <span className="font-medium text-zinc-700 dark:text-zinc-200">{display}</span>
          <span>{max}</span>
        </div>
      )}
      <input
        type="range"
        value={value}
        defaultValue={value === undefined ? defaultValue : undefined}
        min={min}
        max={max}
        step={step}
        className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-zinc-200 accent-indigo-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1 dark:bg-zinc-700 dark:accent-indigo-400"
        style={{ accentColor: 'var(--lokvis-primary, #6366f1)' }}
        {...props}
      />
    </div>
  );
}
