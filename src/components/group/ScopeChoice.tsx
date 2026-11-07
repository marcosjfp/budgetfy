import { useId } from 'react';
import { useI18n } from '../../i18n';
import { cn } from '../ui';
import type { ScopeChoice as Scope } from './groupMath';

interface ScopeChoiceProps {
  value: Scope;
  onChange: (value: Scope) => void;
  /** Which copy to use: deleting or updating a recurring series. */
  mode: 'delete' | 'update';
}

const CHOICES: Scope[] = ['this', 'future', 'series'];

/** Radio cards for "this / this and future / whole series". */
export function ScopeChoice({ value, onChange, mode }: ScopeChoiceProps) {
  const { t } = useI18n();
  const id = useId();
  const prefix = mode === 'delete' ? 'deleteExpense' : 'updateSeries';
  return (
    <fieldset className="space-y-2 pt-1">
      <legend id={id} className="text-sm font-medium text-fg-muted mb-2">
        {mode === 'delete' ? t('deleteExpense.scope') : t('updateSeries.scope')}
      </legend>
      {CHOICES.map((choice) => {
        const selected = value === choice;
        return (
          <label
            key={choice}
            className={cn(
              'flex items-start gap-3 p-3 rounded-control border cursor-pointer transition-colors',
              selected
                ? mode === 'delete'
                  ? 'border-red-500 bg-red-50 dark:bg-red-500/10'
                  : 'border-brand-500 bg-brand-50 dark:bg-brand-500/10'
                : 'border-line-strong hover:bg-surface-2',
            )}
          >
            <input
              type="radio"
              name={id}
              value={choice}
              checked={selected}
              onChange={() => onChange(choice)}
              className={cn('mt-1 size-4 shrink-0', mode === 'delete' ? 'accent-red-600' : 'accent-brand-600')}
            />
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-fg">{t(`${prefix}.${choice}`)}</span>
              <span className="block text-sm text-fg-subtle">{t(`${prefix}.${choice}Desc`)}</span>
            </span>
          </label>
        );
      })}
    </fieldset>
  );
}
