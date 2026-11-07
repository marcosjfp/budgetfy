import React, { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { SUPPORTED_CURRENCIES, useI18n, type Currency } from '../../i18n';
import { currencySymbol as symbolFor } from '../../i18n/core';
import { useCurrencyNames } from '../../hooks/useCurrencyNames';
import type { BudgetType, Group } from '../../types';
import { COLORS } from '../../constants';
import { Button, Modal, SelectField, TextField, TextareaField } from '../ui';
import { ColorPicker } from '../ColorPicker';

export interface GroupSettingsValues {
  name: string;
  description: string;
  themeColor: string;
  maxBudget: number | null;
  budgetType: BudgetType;
  currency: Currency;
}

interface GroupSettingsModalProps {
  open: boolean;
  group: Group;
  canDelete: boolean;
  onClose: () => void;
  onSave: (values: GroupSettingsValues) => Promise<void>;
  onRequestDelete: () => void;
}

export function GroupSettingsModal({ open, group, canDelete, onClose, onSave, onRequestDelete }: GroupSettingsModalProps) {
  // Inside the group's CurrencyScope, `currency` is the group's current (or fallback) currency.
  const { t, lang, currency: currentCurrency } = useI18n();
  const currencyNames = useCurrencyNames();
  const [currency, setCurrency] = useState<Currency>(currentCurrency);
  const symbol = symbolFor(lang, currency);
  const [name, setName] = useState(group.name);
  const [description, setDescription] = useState(group.description || '');
  const [themeColor, setThemeColor] = useState(group.themeColor || COLORS[0].value);
  const [maxBudget, setMaxBudget] = useState(group.maxBudget?.toString() || '');
  const [budgetType, setBudgetType] = useState<BudgetType>(group.budgetType || 'monthly');
  const [errors, setErrors] = useState<{ name?: string; maxBudget?: string }>({});
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const next: typeof errors = {};
    if (!name.trim()) next.name = t('validation.groupNameRequired');
    if (maxBudget && !(parseFloat(maxBudget) > 0)) next.maxBudget = t('validation.amountPositive');
    setErrors(next);
    if (Object.keys(next).length) return;
    setSaving(true);
    try {
      await onSave({
        name: name.trim(),
        description: description.trim(),
        themeColor,
        maxBudget: maxBudget ? parseFloat(maxBudget) : null,
        budgetType: maxBudget ? budgetType : 'total',
        currency,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      dismissible={!saving}
      title={t('group.settings')}
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" form="group-settings-form" loading={saving}>
            {t('settings.save')}
          </Button>
        </>
      }
    >
      <form id="group-settings-form" onSubmit={submit} noValidate className="space-y-6 pb-2">
        <fieldset className="space-y-4">
          <legend className="text-sm font-semibold text-fg mb-3">{t('settings.generalInfo')}</legend>
          <TextField
            label={t('settings.groupName')}
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={100}
            error={errors.name}
            data-autofocus
          />
          <TextareaField label={t('common.description')} value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
          <ColorPicker label={t('settings.themeColor')} value={themeColor} onChange={setThemeColor} />
          <SelectField label={t('settings.currency')} hint={t('settings.currencyHint')} value={currency} onChange={(e) => setCurrency(e.target.value as Currency)}>
            {SUPPORTED_CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c} — {currencyNames[c]}
              </option>
            ))}
          </SelectField>
        </fieldset>

        <div className="pt-5 border-t border-line">
        <fieldset className="space-y-4">
          <legend className="text-sm font-semibold text-fg mb-3">{t('settings.budgetLimits')}</legend>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <TextField
              label={t('settings.maxBudget')}
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              prefix={symbol}
              className="tabular"
              value={maxBudget}
              onChange={(e) => setMaxBudget(e.target.value)}
              placeholder={t('settings.noLimit')}
              error={errors.maxBudget}
            />
            <SelectField label={t('settings.frequency')} value={budgetType} onChange={(e) => setBudgetType(e.target.value as BudgetType)} disabled={!maxBudget}>
              <option value="weekly">{t('budgetFreq.weekly')}</option>
              <option value="monthly">{t('budgetFreq.monthly')}</option>
              <option value="total">{t('budgetFreq.total')}</option>
            </SelectField>
          </div>
        </fieldset>
        </div>

        {canDelete && (
          <div className="pt-5 border-t border-line">
            <p className="text-sm font-semibold text-fg">{t('settings.dangerZone')}</p>
            <p className="text-sm text-fg-subtle mt-1 mb-3">{t('settings.deleteGroupHint')}</p>
            <Button variant="danger-soft" leftIcon={<Trash2 className="size-4" aria-hidden="true" />} onClick={onRequestDelete}>
              {t('settings.deleteGroup')}
            </Button>
          </div>
        )}
      </form>
    </Modal>
  );
}
