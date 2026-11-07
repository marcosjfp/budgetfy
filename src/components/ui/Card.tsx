import React from 'react';
import { cn } from './cn';

type CardProps<T extends React.ElementType> = {
  as?: T;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  interactive?: boolean;
  className?: string;
  children?: React.ReactNode;
} & Omit<React.ComponentPropsWithoutRef<T>, 'as' | 'className' | 'children'>;

const PADDING = { none: '', sm: 'p-4', md: 'p-4 sm:p-6', lg: 'p-6 sm:p-8' };

export function Card<T extends React.ElementType = 'div'>({ as, padding = 'md', interactive, className, children, ...rest }: CardProps<T>) {
  const Comp = (as ?? 'div') as React.ElementType;
  return (
    <Comp
      className={cn(
        'bg-surface border border-line rounded-card shadow-card',
        PADDING[padding],
        interactive && 'text-left transition-[box-shadow,border-color,transform] duration-150 hover:shadow-raised hover:border-line-strong motion-safe:active:scale-[0.99] cursor-pointer',
        className,
      )}
      {...rest}
    >
      {children}
    </Comp>
  );
}

interface CardHeaderProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  /** Heading level for document outline. */
  as?: 'h2' | 'h3';
  id?: string;
  className?: string;
}

export function CardHeader({ title, description, icon, action, as: Heading = 'h2', id, className }: CardHeaderProps) {
  return (
    <div className={cn('flex items-start justify-between gap-3 mb-4', className)}>
      <div className="flex items-start gap-3 min-w-0">
        {icon && <span className="mt-0.5 text-fg-subtle shrink-0" aria-hidden="true">{icon}</span>}
        <div className="min-w-0">
          <Heading id={id} className="text-base font-semibold text-fg font-display tracking-tight">
            {title}
          </Heading>
          {description && <p className="text-sm text-fg-subtle mt-0.5">{description}</p>}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

/** Page-level section heading. */
export function SectionHeading({ title, icon, action, id }: { title: React.ReactNode; icon?: React.ReactNode; action?: React.ReactNode; id?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 mb-4">
      <h2 id={id} className="text-lg font-semibold tracking-tight text-fg font-display flex items-center gap-2">
        {icon && <span aria-hidden="true" className="text-fg-subtle">{icon}</span>}
        {title}
      </h2>
      {action}
    </div>
  );
}
