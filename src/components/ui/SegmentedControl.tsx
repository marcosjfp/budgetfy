import React, { useRef } from 'react';
import { cn } from './cn';

export interface SegmentOption<T extends string> {
  value: T;
  label: React.ReactNode;
  icon?: React.ReactNode;
  /** Accessible name when label is visual only. */
  ariaLabel?: string;
  lang?: string;
}

interface SegmentedControlProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  options: SegmentOption<T>[];
  /** Accessible group label. */
  label: string;
  /** id of a visible element labelling the group (overrides `label`). */
  labelledBy?: string;
  size?: 'sm' | 'md';
  fullWidth?: boolean;
  className?: string;
}

/** Single-choice toggle (radio group semantics, arrow-key navigation). */
export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  label,
  labelledBy,
  size = 'md',
  fullWidth,
  className,
}: SegmentedControlProps<T>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const onKeyDown = (e: React.KeyboardEvent, index: number) => {
    let next = -1;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (index + 1) % options.length;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (index - 1 + options.length) % options.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = options.length - 1;
    if (next >= 0) {
      e.preventDefault();
      onChange(options[next].value);
      refs.current[next]?.focus();
    }
  };

  return (
    <div
      role="radiogroup"
      aria-label={labelledBy ? undefined : label}
      aria-labelledby={labelledBy}
      className={cn('inline-flex rounded-control bg-surface-2 p-1 border border-line gap-1', fullWidth && 'flex w-full', className)}
    >
      {options.map((opt, i) => {
        const selected = opt.value === value;
        return (
          <button
            key={opt.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={opt.ariaLabel}
            lang={opt.lang}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(opt.value)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={cn(
              'inline-flex items-center justify-center gap-1.5 rounded-[calc(var(--radius-control)-4px)] font-medium transition-colors duration-150',
              size === 'sm' ? 'h-8 pointer-coarse:h-10 px-2.5 text-xs' : 'h-9 pointer-coarse:h-10 px-3 text-sm',
              fullWidth && 'flex-1 min-w-0',
              selected ? 'bg-surface text-fg shadow-card' : 'text-fg-subtle hover:text-fg',
            )}
          >
            {opt.icon && <span aria-hidden="true" className="[&>svg]:size-4 shrink-0">{opt.icon}</span>}
            <span className="truncate">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}
