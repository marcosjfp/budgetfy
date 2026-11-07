import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Users, Home, Plane, Briefcase, Sparkles } from 'lucide-react';
import type { GroupType, BudgetType, Group } from '../types';
import { track } from '../analytics';
import { apiFetch } from '../api';
import { SUPPORTED_CURRENCIES, useI18n, type Currency } from '../i18n';
import { currencySymbol as symbolFor } from '../i18n/core';
import { useCurrencyNames } from '../hooks/useCurrencyNames';
import { handleFirestoreError, OperationType } from '../utils/errorHandling';
import { Button, Modal, SelectField, TextField, TextareaField, FieldsetLabel, cn } from './ui';
import { ColorPicker } from './ColorPicker';
import { COLORS } from '../constants';

interface CreateGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (group: Group) => void;
}

const TYPES: { id: GroupType; icon: typeof Home }[] = [
  { id: 'household', icon: Home },
  { id: 'trip', icon: Plane },
  { id: 'personal', icon: Users },
  { id: 'other', icon: Briefcase },
  { id: 'custom', icon: Sparkles },
];

export default function CreateGroupModal({ isOpen, onClose, onCreated }: CreateGroupModalProps) {
  const { t, lang, currency: preferredCurrency } = useI18n();
  const currencyNames = useCurrencyNames();
  // Defaults to the creator's preferred currency.
  const [currency, setCurrency] = useState<Currency>(preferredCurrency);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<GroupType>('household');
  const [themeColor, setThemeColor] = useState(COLORS[0].value);
  const [maxBudget, setMaxBudget] = useState('');
  const [budgetType, setBudgetType] = useState<BudgetType>('monthly');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<{ name?: string; maxBudget?: string }>({});

  const reset = () => {
    setName('');
    setDescription('');
    setType('household');
    setThemeColor(COLORS[0].value);
    setMaxBudget('');
    setBudgetType('monthly');
    setCurrency(preferredCurrency);
    setErrors({});
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    const next: typeof errors = {};
    if (!name.trim()) next.name = t('validation.groupNameRequired');
    if (maxBudget && !(parseFloat(maxBudget) > 0)) next.maxBudget = t('validation.amountPositive');
    setErrors(next);
    if (Object.keys(next).length) return;

    setIsSubmitting(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const groupData: any = { name: name.trim(), description: description.trim(), type, themeColor, currency };
      if (maxBudget) {
        groupData.maxBudget = parseFloat(maxBudget);
        groupData.budgetType = budgetType;
      }
      const created = await apiFetch('/groups', { method: 'POST', body: JSON.stringify(groupData) });
      track('Group Created');
      reset();
      onCreated(created ?? { ...groupData, id: '' });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'groups');
    } finally {
      setIsSubmitting(false);
    }
  };

  const typeLabelId = 'create-group-type-label';

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      dismissible={!isSubmitting}
      title={t('createGroup.title')}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" form="create-group-form" loading={isSubmitting}>
            {isSubmitting ? t('createGroup.creating') : t('createGroup.submit')}
          </Button>
        </>
      }
    >
      <form id="create-group-form" onSubmit={handleSubmit} noValidate className="space-y-5 pb-2">
        <TextField
          label={t('createGroup.name')}
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (errors.name) setErrors((p) => ({ ...p, name: undefined }));
          }}
          placeholder={t('createGroup.namePlaceholder')}
          required
          maxLength={100}
          error={errors.name}
          data-autofocus
        />

        <TextareaField
          label={t('createGroup.description')}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={t('createGroup.descriptionPlaceholder')}
          rows={2}
        />

        <div className="flex flex-col gap-1.5">
          <FieldsetLabel id={typeLabelId}>{t('createGroup.type')}</FieldsetLabel>
          <div role="radiogroup" aria-labelledby={typeLabelId} className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {TYPES.map(({ id, icon: Icon }) => {
              const selected = type === id;
              return (
                <button
                  key={id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setType(id)}
                  className={cn(
                    'flex items-center gap-2.5 min-h-11 px-3 py-2.5 rounded-control border text-sm font-medium transition-colors text-left',
                    selected
                      ? 'border-brand-500 bg-brand-50 text-brand-800 ring-1 ring-brand-500 dark:bg-brand-500/15 dark:text-brand-100'
                      : 'border-line-strong bg-surface text-fg-muted hover:bg-surface-2 hover:text-fg',
                  )}
                >
                  <Icon className="size-4 shrink-0" aria-hidden="true" />
                  <span className="truncate">{t(`groupType.${id}`)}</span>
                </button>
              );
            })}
          </div>
        </div>

        <AnimatePresence initial={false}>
          {type === 'custom' && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
              <ColorPicker label={t('createGroup.themeColor')} value={themeColor} onChange={setThemeColor} />
            </motion.div>
          )}
        </AnimatePresence>

        <div className="pt-5 border-t border-line">
        <fieldset>
          <legend className="text-sm font-semibold text-fg mb-3">{t('createGroup.budgetSettings')}</legend>
          <SelectField
            containerClassName="mb-4"
            label={t('settings.currency')}
            hint={t('settings.currencyHint')}
            value={currency}
            onChange={(e) => setCurrency(e.target.value as Currency)}
          >
            {SUPPORTED_CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c} — {currencyNames[c]}
              </option>
            ))}
          </SelectField>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <TextField
              label={t('createGroup.maxBudget')}
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={maxBudget}
              onChange={(e) => {
                setMaxBudget(e.target.value);
                if (errors.maxBudget) setErrors((p) => ({ ...p, maxBudget: undefined }));
              }}
              placeholder={t('settings.noLimit')}
              prefix={symbolFor(lang, currency)}
              className="tabular"
              error={errors.maxBudget}
            />
            <SelectField label={t('createGroup.frequency')} value={budgetType} onChange={(e) => setBudgetType(e.target.value as BudgetType)} disabled={!maxBudget}>
              <option value="weekly">{t('budgetFreq.weekly')}</option>
              <option value="monthly">{t('budgetFreq.monthly')}</option>
              <option value="total">{t('budgetFreq.total')}</option>
            </SelectField>
          </div>
        </fieldset>
        </div>
      </form>
    </Modal>
  );
}
