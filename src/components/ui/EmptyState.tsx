import React from 'react';
import { cn } from './cn';

interface EmptyStateProps {
  icon: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  compact?: boolean;
  className?: string;
}

export function EmptyState({ icon, title, description, action, compact, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center text-center', compact ? 'py-8 px-4' : 'py-12 px-6', className)}>
      <div
        className={cn(
          'flex items-center justify-center rounded-2xl bg-surface-2 text-fg-subtle mb-4',
          compact ? 'size-11 [&>svg]:size-5' : 'size-14 [&>svg]:size-7',
        )}
        aria-hidden="true"
      >
        {icon}
      </div>
      <p className={cn('font-semibold text-fg', compact ? 'text-sm' : 'text-base')}>{title}</p>
      {description && <p className="mt-1 text-sm text-fg-subtle max-w-sm">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
