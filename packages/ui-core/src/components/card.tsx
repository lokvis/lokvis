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
      className={`rounded-xl border border-zinc-200 bg-white p-6 transition-all duration-200 dark:border-zinc-800 dark:bg-zinc-900 ${
        hoverable
          ? 'cursor-default hover:border-zinc-300 hover:shadow-md hover:shadow-zinc-200/50 dark:hover:border-zinc-700 dark:hover:shadow-md dark:hover:shadow-black/20'
          : ''
      } ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
