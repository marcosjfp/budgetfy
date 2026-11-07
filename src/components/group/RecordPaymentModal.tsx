import React, { useState } from 'react';
import { HandCoins } from 'lucide-react';
import type { GroupMember } from '../../types';
import { useI18n } from '../../i18n';
import { toDateInputValue } from '../../utils/budget';
import { Button, Modal, SelectField, TextField } from '../ui';

export interface PaymentDraft {
  fromUser: string;
  toUser: string;
  amount: number;
}

export interface PaymentPayload extends PaymentDraft {
  date: string;
  note: string | null;
}

interface RecordPaymentModalProps {
  open: boolean;
  /** Prefill (e.g. from a suggested transfer). */
  draft: PaymentDraft | null;
  members: GroupMember[];
  currentUserId: string;
  isAdmin: boolean;
  onClose: () => void;
  onSubmit: (payload: PaymentPayload) => Promise<void>;
}

type Errors = Partial<Record<'fromUser' | 'toUser' | 'amount', string>>;

/** Record a settle-up payment made outside the app. Mount with a fresh `key` per opening. */
export function RecordPaymentModal({ open, draft, members, currentUserId, isAdmin, onClose, onSubmit }: RecordPaymentModalProps) {
  const { t, currencySymbol } = useI18n();
  const firstOther = members.find((m) => m.uid !== currentUserId)?.uid ?? '';
  const [fromUser, setFromUser] = useState(draft?.fromUser ?? currentUserId);
  const [toUser, setToUser] = useState(draft?.toUser ?? firstOther);
  const [amount, setAmount] = useState(draft ? draft.amount.toFixed(2) : '');
  const [date, setDate] = useState(toDateInputValue(new Date()));
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);

  const name = (m: GroupMember) => (m.uid === currentUserId ? t('settle.youName') : m.displayName || m.email || t('common.unknown'));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const next: Errors = {};
    const value = parseFloat(amount);
    if (!fromUser) next.fromUser = t('settle.pickPerson');
    if (!toUser) next.toUser = t('settle.pickPerson');
    else if (fromUser === toUser) next.toUser = t('settle.samePerson');
    if (!(value > 0)) next.amount = t('validation.amountPositive');
    if (!next.toUser && !isAdmin && fromUser !== currentUserId && toUser !== currentUserId) next.toUser = t('settle.mustInvolveYou');
    setErrors(next);
    if (Object.keys(next).length) return;
    setSaving(true);
    try {
      await onSubmit({ fromUser, toUser, amount: Math.round(value * 100) / 100, date /* calendar date (YYYY-MM-DD) */, note: note.trim() || null });
    } catch {
      // reported by caller; keep the form open
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      dismissible={!saving}
      icon={<HandCoins className="size-5" />}
      title={t('settle.recordTitle')}
      description={t('settle.recordSubtitle')}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" form="record-payment-form" loading={saving}>
            {t('settle.recordSubmit')}
          </Button>
        </>
      }
    >
      <form id="record-payment-form" onSubmit={submit} noValidate className="space-y-4 pb-2">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <SelectField label={t('settle.from')} value={fromUser} onChange={(e) => setFromUser(e.target.value)} error={errors.fromUser} required>
            {members.map((m) => (
              <option key={m.uid} value={m.uid}>
                {name(m)}
              </option>
            ))}
          </SelectField>
          <SelectField label={t('settle.to')} value={toUser} onChange={(e) => setToUser(e.target.value)} error={errors.toUser} required>
            {members.map((m) => (
              <option key={m.uid} value={m.uid}>
                {name(m)}
              </option>
            ))}
          </SelectField>
        </div>
        <TextField
          label={t('common.amount')}
          type="number"
          inputMode="decimal"
          step="0.01"
          min="0"
          prefix={currencySymbol}
          className="tabular"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          error={errors.amount}
          required
          data-autofocus
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <TextField label={t('common.date')} type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          <TextField label={t('settle.note')} value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} placeholder={t('settle.notePlaceholder')} />
        </div>
      </form>
    </Modal>
  );
}
