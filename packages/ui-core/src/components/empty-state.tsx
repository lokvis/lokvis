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
      {icon && <div className="mb-4 text-zinc-400">{icon}</div>}
      <h3 className="mb-2 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
        {title}
      </h3>
      {description && (
        <p className="mb-6 max-w-sm text-sm text-zinc-500 dark:text-zinc-400">
          {description}
        </p>
      )}
      {action}
    </div>
  );
}
