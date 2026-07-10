import * as React from 'react';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

/**
 * Textarea - 多行文本输入框。
 *
 * 与 Input 统一的样式语言:token 化边框、字号、focus 环、disabled 态。
 */
export function Textarea({
 className = '',
 disabled,
 ...props
}: TextareaProps) {
 return (
  <textarea
   disabled={disabled}
   className={`w-full min-h-[80px] rounded-[var(--lokvis-radius-sm)] border border-[var(--lokvis-border)] bg-[var(--lokvis-surface)] px-[var(--lokvis-space-3)] py-[var(--lokvis-space-2)] text-[length:var(--lokvis-text-sm)] text-[var(--lokvis-fg)] placeholder:text-[var(--lokvis-fg-subtle)] transition-colors resize-y hover:border-[var(--lokvis-border-strong)] focus:border-[var(--lokvis-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lokvis-primary)]/30 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
   {...props}
  />
 );
}
