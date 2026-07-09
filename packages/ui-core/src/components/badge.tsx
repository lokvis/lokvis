import * as React from 'react';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
 variant?: 'default' | 'success' | 'warning' | 'danger' | 'info';
}

const variantClasses: Record<string, string> = {
 default: 'bg-[var(--lokvis-surface-muted)] text-[var(--lokvis-fg)]',
 success: 'bg-[var(--lokvis-success)]/15 text-[var(--lokvis-success)]',
 warning: 'bg-[var(--lokvis-warning)]/15 text-[var(--lokvis-warning)]',
 danger: 'bg-[var(--lokvis-danger)]/15 text-[var(--lokvis-danger)]',
 info: 'bg-[var(--lokvis-info)]/15 text-[var(--lokvis-info)]',
};

export function Badge({
 variant = 'default',
 className = '',
 children,
 ...props
}: BadgeProps) {
 return (
 <span
 className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${variantClasses[variant]} ${className}`}
 {...props}
 >
 {children}
 </span>
 );
}
