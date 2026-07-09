import * as React from 'react';

export interface EmptyStateProps {
 icon?: React.ReactNode;
 title: string;
 description?: string;
 action?: React.ReactNode;
 className?: string;
}

export function EmptyState({
 icon,
 title,
 description,
 action,
 className = '',
}: EmptyStateProps) {
 return (
 <div
 className={`flex flex-col items-center justify-center py-12 text-center ${className}`}
 >
 {icon && <div className="mb-4 text-[var(--lokvis-fg-subtle)]">{icon}</div>}
 <h3 className="mb-2 text-lg font-semibold text-[var(--lokvis-fg)]">
 {title}
 </h3>
 {description && (
 <p className="mb-6 max-w-sm text-sm text-[var(--lokvis-fg-muted)]">
 {description}
 </p>
 )}
 {action}
 </div>
 );
}
