import React from 'react';
import { cn } from './cn';

export type BadgeTone = 'neutral' | 'brand' | 'success' | 'warning' | 'danger';

// All tones ≥ 4.5:1 text contrast on their own background in both themes.
const TONES: Record<BadgeTone, string> = {
  neutral: 'bg-surface-2 text-fg-muted border-line',
  brand: 'bg-brand-50 text-brand-700 border-brand-100 dark:bg-brand-500/15 dark:text-brand-200 dark:border-brand-500/25',
  success: 'bg-emerald-50 text-emerald-800 border-emerald-100 dark:bg-emerald-500/15 dark:text-emerald-200 dark:border-emerald-500/25',
  warning: 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-500/15 dark:text-amber-200 dark:border-amber-500/25',
  danger: 'bg-red-50 text-red-700 border-red-100 dark:bg-red-500/15 dark:text-red-200 dark:border-red-500/25',
};

interface BadgeProps {
  tone?: BadgeTone;
  icon?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
  title?: string;
}

export function Badge({ tone = 'neutral', icon, className, children, title }: BadgeProps) {
  return (
    <span
      title={title}
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap',
        TONES[tone],
        className,
      )}
    >
      {icon && <span aria-hidden="true" className="[&>svg]:size-3.5">{icon}</span>}
      {children}
    </span>
  );
}
