import * as React from 'react';

export interface SelectOption {
 value: string;
 label: string;
 disabled?: boolean;
}

export interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'onChange'> {
 /** 选项列表(也可用 children <option>) */
 options?: SelectOption[];
 /** 占位符(渲染为 disabled 的首个 option) */
 placeholder?: string;
 /** 值变更回调 */
 onChange?: (value: string) => void;
}

/**
 * Select - 下拉选择。
 *
 * 基于原生 `<select>`,带自定义箭头图标。支持 `options` prop 或 children `<option>`。
 */
export function Select({
 options,
 placeholder,
 value,
 defaultValue,
 onChange,
 className = '',
 children,
 ...props
}: SelectProps) {
 const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
 onChange?.(e.target.value);
 };

 return (
 <div className={`relative inline-block ${className}`}>
 <select
 value={value}
 defaultValue={value === undefined ? defaultValue : undefined}
 onChange={handleChange}
 className="w-full appearance-none rounded-md border border-[var(--lokvis-border)] bg-[var(--lokvis-surface)] py-1.5 pl-3 pr-9 text-sm text-[var(--lokvis-fg)] transition-colors focus:border-[var(--lokvis-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lokvis-primary)]/40 disabled:cursor-not-allowed disabled:opacity-50"
 {...props}
 >
 {placeholder && (
 <option value="" disabled>
 {placeholder}
 </option>
 )}
 {options
 ? options.map((opt) => (
 <option key={opt.value} value={opt.value} disabled={opt.disabled}>
 {opt.label}
 </option>
 ))
 : children}
 </select>
 <svg
 className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--lokvis-fg-subtle)]"
 xmlns="http://www.w3.org/2000/svg"
 viewBox="0 0 24 24"
 fill="none"
 stroke="currentColor"
 strokeWidth="2"
 strokeLinecap="round"
 strokeLinejoin="round"
 >
 <polyline points="6 9 12 15 18 9" />
 </svg>
 </div>
 );
}
