import React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from './cn';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'danger-soft';
export type ButtonSize = 'sm' | 'md' | 'lg';

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'bg-brand-600 text-white hover:bg-brand-700 active:bg-brand-800 shadow-sm shadow-brand-600/20',
  secondary:
    'bg-surface text-fg border border-line-strong hover:bg-surface-2 active:bg-surface-3 shadow-card',
  ghost: 'text-fg-muted hover:text-fg hover:bg-surface-2 active:bg-surface-3',
  danger: 'bg-red-600 text-white hover:bg-red-700 active:bg-red-800 shadow-sm shadow-red-600/20',
  'danger-soft':
    'bg-red-50 text-red-700 hover:bg-red-100 dark:bg-red-500/10 dark:text-red-300 dark:hover:bg-red-500/20',
};

// md/lg are ≥ 44px tall; sm grows to 44px on touch devices.
const SIZES: Record<ButtonSize, string> = {
  sm: 'h-9 pointer-coarse:h-11 px-3 text-sm gap-1.5',
  md: 'h-11 px-4 text-sm gap-2',
  lg: 'h-12 px-5 text-base gap-2',
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
  ref?: React.Ref<HTMLButtonElement>;
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  leftIcon,
  rightIcon,
  fullWidth,
  className,
  children,
  disabled,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        'inline-flex items-center justify-center rounded-control font-semibold whitespace-nowrap select-none',
        'transition-colors duration-150 disabled:opacity-55 disabled:cursor-not-allowed',
        VARIANTS[variant],
        SIZES[size],
        fullWidth && 'w-full',
        className,
      )}
      {...rest}
    >
      {loading ? <Loader2 className="size-4 animate-spin shrink-0" aria-hidden="true" /> : leftIcon}
      {children}
      {!loading && rightIcon}
    </button>
  );
}

export interface IconButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  /** Accessible name; also shown as a tooltip. */
  label: string;
  icon: React.ReactNode;
  variant?: 'ghost' | 'secondary' | 'danger';
  size?: 'sm' | 'md';
  ref?: React.Ref<HTMLButtonElement>;
}

export function IconButton({
  label,
  icon,
  variant = 'ghost',
  size = 'md',
  className,
  type = 'button',
  ...rest
}: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex items-center justify-center rounded-control shrink-0 transition-colors duration-150',
        'disabled:opacity-55 disabled:cursor-not-allowed',
        size === 'sm' ? 'size-9 pointer-coarse:size-11' : 'size-11',
        variant === 'ghost' && 'text-fg-subtle hover:text-fg hover:bg-surface-2',
        variant === 'secondary' && 'bg-surface text-fg-muted border border-line-strong hover:text-fg hover:bg-surface-2 shadow-card',
        variant === 'danger' && 'text-fg-subtle hover:text-red-700 hover:bg-red-50 dark:hover:text-red-300 dark:hover:bg-red-500/10',
        className,
      )}
      {...rest}
    >
      {icon}
    </button>
  );
}
