import * as React from 'react';

export type InputSize = 'sm' | 'md' | 'lg';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
 /** 前置图标槽位(传 <Icon> 组件) */
 leadingIcon?: React.ReactNode;
 /** 后置图标槽位 */
 trailingIcon?: React.ReactNode;
 /** 控件高度变体,消费 --lokvis-control-h-{sm,lg} token(默认 md) */
 size?: InputSize;
}

/**
 * Input - 文本输入框。
 *
 * 统一样式:token 化的边框、字号、间距、focus 环、disabled 态。
 * 可选前置/后置图标槽位,用于搜索框等场景。
 *
 * @example
 * ```tsx
 * <Input placeholder="Search..." />
 * <Input leadingIcon={<Icon name="Search" />} placeholder="Filter..." />
 * ```
 */
export function Input({
 leadingIcon,
 trailingIcon,
 size = 'md',
 className = '',
 disabled,
 ...props
}: InputProps) {
 const hasLeading = !!leadingIcon;
 const hasTrailing = !!trailingIcon;

 // 高度变体消费 --lokvis-control-h-{sm,lg} token(此前无消费者,见 gap 4.1.3)
 const heightClass =
  size === 'sm'
   ? 'h-[var(--lokvis-control-h-sm)] text-[length:var(--lokvis-text-xs)]'
   : size === 'lg'
   ? 'h-[var(--lokvis-control-h-lg)] text-[length:var(--lokvis-text-base)]'
   : 'h-[var(--lokvis-control-h)] text-[length:var(--lokvis-text-sm)]';

 const input = (
  <input
   disabled={disabled}
   className={`w-full ${heightClass} rounded-[var(--lokvis-radius-sm)] border border-[var(--lokvis-border)] bg-[var(--lokvis-surface)] text-[var(--lokvis-fg)] placeholder:text-[var(--lokvis-fg-subtle)] transition-colors hover:border-[var(--lokvis-border-strong)] focus:border-[var(--lokvis-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lokvis-primary)]/30 disabled:cursor-not-allowed disabled:opacity-50 ${
    hasLeading ? 'pl-8' : 'pl-[var(--lokvis-space-3)]'
   } ${hasTrailing ? 'pr-8' : 'pr-[var(--lokvis-space-3)]'} ${className}`}
   {...props}
  />
 );

 if (!hasLeading && !hasTrailing) return input;

 return (
  <div className="relative inline-block w-full">
   {hasLeading && (
    <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--lokvis-fg-subtle)]">
     {leadingIcon}
    </span>
   )}
   {input}
   {hasTrailing && (
    <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--lokvis-fg-subtle)]">
     {trailingIcon}
    </span>
   )}
  </div>
 );
}
