import { useId } from 'react';
import { Check } from 'lucide-react';
import { COLORS } from '../constants';
import { COLOR_KEYS, useI18n } from '../i18n';
import { FieldsetLabel, cn } from './ui';

interface ColorPickerProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
}

/** Theme colour swatches with radio semantics. */
export function ColorPicker({ label, value, onChange }: ColorPickerProps) {
  const { label: tLabel } = useI18n();
  const id = useId();
  return (
    <div className="flex flex-col gap-2">
      <FieldsetLabel id={id}>{label}</FieldsetLabel>
      <div role="radiogroup" aria-labelledby={id} className="flex flex-wrap gap-2">
        {COLORS.map((color) => {
          const selected = value === color.value;
          const name = tLabel(COLOR_KEYS, color.name);
          return (
            <button
              key={color.value}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={name}
              title={name}
              onClick={() => onChange(color.value)}
              className={cn(
                'size-11 rounded-full flex items-center justify-center transition-transform ring-offset-2 ring-offset-surface',
                color.bg,
                selected ? 'ring-2 ring-fg scale-105' : 'hover:scale-105',
              )}
            >
              {selected && <Check className="size-5 text-white" aria-hidden="true" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
