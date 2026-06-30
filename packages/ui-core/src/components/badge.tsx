import * as React from 'react';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info';
}

const variantClasses: Record<string, string> = {
  default: 'bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100',
  success: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-100',
  warning: 'bg-yellow-100 text-yellow-900 dark:bg-yellow-900/40 dark:text-yellow-100',
  danger: 'bg-red-100 text-red-900 dark:bg-red-900/40 dark:text-red-100',
  info: 'bg-blue-100 text-blue-900 dark:bg-blue-900/40 dark:text-blue-100',
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
