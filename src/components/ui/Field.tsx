import React, { useId } from 'react';
import { AlertCircle } from 'lucide-react';
import { cn } from './cn';

/** Shared look for text inputs, selects and textareas. */
export const controlClass = cn(
  'w-full min-h-11 rounded-control border bg-surface px-3.5 py-2.5 text-base sm:text-sm text-fg',
  'placeholder:text-fg-subtle transition-colors duration-150',
  'border-line-strong hover:border-fg-subtle',
  'focus:outline-none focus-visible:outline-none focus:border-brand-500 focus:ring-3 focus:ring-brand-500/20',
  'disabled:opacity-60 disabled:cursor-not-allowed',
  'aria-[invalid=true]:border-red-500 aria-[invalid=true]:focus:ring-red-500/20',
);

interface FieldShellProps {
  id: string;
  label: React.ReactNode;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  required?: boolean;
  /** Visually hide the label (still read by screen readers). */
  hideLabel?: boolean;
  className?: string;
  children: React.ReactNode;
}

function FieldShell({ id, label, hint, error, required, hideLabel, className, children }: FieldShellProps) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className={cn('text-sm font-medium text-fg-muted', hideLabel && 'sr-only')}>
        {label}
        {required && <span aria-hidden="true" className="text-red-600 dark:text-red-400"> *</span>}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="flex items-start gap-1.5 text-sm text-red-700 dark:text-red-300" role="alert">
          <AlertCircle className="size-4 shrink-0 mt-0.5" aria-hidden="true" />
          <span>{error}</span>
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-sm text-fg-subtle">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

function describedBy(id: string, error?: React.ReactNode, hint?: React.ReactNode) {
  if (error) return `${id}-error`;
  if (hint) return `${id}-hint`;
  return undefined;
}

type CommonProps = {
  label: React.ReactNode;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  hideLabel?: boolean;
  containerClassName?: string;
};

export interface TextFieldProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'prefix'>, CommonProps {
  /** Static adornment inside the input on the left (e.g. currency symbol). */
  prefix?: React.ReactNode;
  /** Interactive or static adornment on the right (e.g. show-password button). */
  suffix?: React.ReactNode;
  ref?: React.Ref<HTMLInputElement>;
}

export function TextField({
  label,
  hint,
  error,
  hideLabel,
  containerClassName,
  prefix,
  suffix,
  id: idProp,
  className,
  required,
  ...rest
}: TextFieldProps) {
  const autoId = useId();
  const id = idProp ?? autoId;
  return (
    <FieldShell id={id} label={label} hint={hint} error={error} required={required} hideLabel={hideLabel} className={containerClassName}>
      <div className="relative">
        {prefix && (
          <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-fg-subtle font-medium" aria-hidden="true">
            {prefix}
          </span>
        )}
        <input
          id={id}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(id, error, hint)}
          className={cn(controlClass, prefix ? 'pl-11' : undefined, suffix && !/(^|\s)pr-/.test(className ?? '') ? 'pr-12' : undefined, className)}
          {...rest}
        />
        {suffix && <div className="absolute inset-y-0 right-0 flex items-center pr-1">{suffix}</div>}
      </div>
    </FieldShell>
  );
}

export interface SelectFieldProps extends React.SelectHTMLAttributes<HTMLSelectElement>, CommonProps {
  ref?: React.Ref<HTMLSelectElement>;
}

export function SelectField({ label, hint, error, hideLabel, containerClassName, id: idProp, className, required, children, ...rest }: SelectFieldProps) {
  const autoId = useId();
  const id = idProp ?? autoId;
  return (
    <FieldShell id={id} label={label} hint={hint} error={error} required={required} hideLabel={hideLabel} className={containerClassName}>
      <div className="relative">
        <select
          id={id}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(id, error, hint)}
          className={cn(controlClass, 'appearance-none pr-10', className)}
          {...rest}
        >
          {children}
        </select>
        <svg className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 size-4 text-fg-subtle" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.17l3.71-3.94a.75.75 0 1 1 1.08 1.04l-4.25 4.5a.75.75 0 0 1-1.08 0l-4.25-4.5a.75.75 0 0 1 .02-1.06Z" clipRule="evenodd" />
        </svg>
      </div>
    </FieldShell>
  );
}

export interface TextareaFieldProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement>, CommonProps {
  ref?: React.Ref<HTMLTextAreaElement>;
}

export function TextareaField({ label, hint, error, hideLabel, containerClassName, id: idProp, className, required, ...rest }: TextareaFieldProps) {
  const autoId = useId();
  const id = idProp ?? autoId;
  return (
    <FieldShell id={id} label={label} hint={hint} error={error} required={required} hideLabel={hideLabel} className={containerClassName}>
      <textarea
        id={id}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, error, hint)}
        className={cn(controlClass, 'min-h-24 resize-y', className)}
        {...rest}
      />
    </FieldShell>
  );
}

/** Group label for a set of controls (radio cards, segmented controls…). */
export function FieldsetLabel({ id, children }: { id?: string; children: React.ReactNode }) {
  return (
    <span id={id} className="text-sm font-medium text-fg-muted">
      {children}
    </span>
  );
}
