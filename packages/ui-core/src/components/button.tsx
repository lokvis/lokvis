import * as React from 'react';
import { FOCUS_RING, DISABLED_STYLE } from '../styles/constants.js';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
}

const variantClasses: Record<string, string> = {
 primary:
 'bg-[var(--lokvis-fg)] text-[var(--lokvis-bg)] hover:bg-[var(--lokvis-surface-muted)] shadow-[var(--lokvis-elevation-1)]',
 secondary:
 'bg-[var(--lokvis-surface-muted)] text-[var(--lokvis-fg)] hover:bg-[var(--lokvis-border)]',
 ghost:
 'bg-transparent text-[var(--lokvis-fg-muted)] hover:bg-[var(--lokvis-surface-muted)]',
 danger: 'bg-[var(--lokvis-danger)] text-[var(--lokvis-primary-fg)] hover:bg-[var(--lokvis-danger-hover)] shadow-[var(--lokvis-elevation-1)]',
};

const sizeClasses: Record<string, string> = {
 sm: 'h-8 px-3 text-sm gap-1.5',
 md: 'h-10 px-4 text-sm gap-2',
 lg: 'h-12 px-6 text-base gap-2',
};

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  className = '',
  children,
  ...props
}: ButtonProps) {
 return (
 <button
 className={`inline-flex items-center justify-center rounded-lg font-medium transition-all duration-150 ${FOCUS_RING} ${DISABLED_STYLE} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
 disabled={disabled || loading}
 {...props}
 >
 {loading && (
 <svg
 className="h-4 w-4 animate-spin"
 xmlns="http://www.w3.org/2000/svg"
 fill="none"
 viewBox="0 0 24 24"
 >
 <circle
 className="opacity-25"
 cx="12"
 cy="12"
 r="10"
 stroke="currentColor"
 strokeWidth="4"
 />
 <path
 className="opacity-75"
 fill="currentColor"
 d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
 />
 </svg>
 )}
 {children}
 </button>
 );
}
