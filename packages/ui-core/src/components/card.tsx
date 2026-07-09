import * as React from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
 hoverable?: boolean;
}

export function Card({
 hoverable = false,
 className = '',
 children,
 ...props
}: CardProps) {
 return (
 <div
 className={`rounded-xl border border-[var(--lokvis-border)] bg-[var(--lokvis-surface)] p-6 transition-all duration-200 ${
 hoverable
 ? 'cursor-default hover:border-[var(--lokvis-border-strong)] hover:shadow-md hover:shadow-zinc-200/50'
 : ''
 } ${className}`}
 {...props}
 >
 {children}
 </div>
 );
}
