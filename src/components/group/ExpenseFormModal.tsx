import React, { useId, useState } from 'react';
import { Repeat } from 'lucide-react';
import { CATEGORIES, type Expense, type GroupMember, type SplitType } from '../../types';
import { useI18n, CATEGORY_KEYS, SPLIT_KEYS } from '../../i18n';
import { toDateInputValue } from '../../utils/budget';
import { categoryStyle } from '../CategoryIcon';
import { Avatar, Button, ConfirmDialog, FieldsetLabel, Modal, SegmentedControl, SelectField, TextField, cn } from '../ui';
import { ScopeChoice } from './ScopeChoice';
import { evenSplit, initialSplit, sumBy, type ScopeChoice as Scope } from './groupMath';

export type RecurrenceFrequency = 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface ExpensePayload {
  amount: number;
  description: string;
  category: string;
  paidBy: string;
  status: 'paid' | 'pending';
  splitType: SplitType;
  splitDetails: Record<string, number>;
  dueDate: string | null;
  date: string;
}

export interface ExpenseSubmit {
  data: ExpensePayload;
  /** Only for new expenses. */
  /** endDate is a calendar date (YYYY-MM-DD); the server creates the occurrences. */
  recurrence: { frequency: RecurrenceFrequency; endDate: string } | null;
  /** Only when editing a recurring expense. */
  scope: Scope;
}

interface ExpenseFormModalProps {
  open: boolean;
  onClose: () => void;
  /** The expense being edited, or null to add a new one. */
  expense: Expense | null;
  initialScope?: Scope;
  members: GroupMember[];
  currentUserId: string;
  onSubmit: (submit: ExpenseSubmit) => Promise<void>;
}

type Errors = Partial<Record<'amount' | 'description' | 'split' | 'endDate', string>>;

export function ExpenseFormModal({ open, onClose, expense, initialScope = 'this', members, currentUserId, onSubmit }: ExpenseFormModalProps) {
  const { t, label, formatCurrency, formatNumber, currencySymbol } = useI18n();
  const categoryLabelId = useId();
  const splitLabelId = useId();
  const statusLabelId = useId();

  const [amount, setAmount] = useState(expense ? expense.amount.toString() : '');
  const [description, setDescription] = useState(expense?.description ?? '');
  const [category, setCategory] = useState(expense?.category ?? CATEGORIES[0]);
  const [date, setDate] = useState(toDateInputValue(expense ? expense.date.toDate() : new Date()));
  const [dueDate, setDueDate] = useState(expense?.dueDate ? toDateInputValue(expense.dueDate.toDate()) : '');
  const [status, setStatus] = useState<'paid' | 'pending'>(expense?.status || 'paid');
  const [splitType, setSplitType] = useState<SplitType>(expense?.splitType || 'equal');
  const [splitDetails, setSplitDetails] = useState<Record<string, number>>(expense?.splitDetails || {});
  const [isRecurring, setIsRecurring] = useState(false);
  const [frequency, setFrequency] = useState<RecurrenceFrequency>('monthly');
  const [endDate, setEndDate] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);
  const [scopeOpen, setScopeOpen] = useState(false);
  const [scope, setScope] = useState<Scope>(initialScope);

  const amountNum = parseFloat(amount || '0');
  const splitTotal = sumBy(Object.values(splitDetails), (v) => v);
  const splitTarget = splitType === 'percentage' ? 100 : amountNum;
  const splitDiff = splitTarget - splitTotal;
  const isSplitValid = splitType === 'equal' || Math.abs(splitDiff) <= 0.01;

  const fmtSplit = (v: number) =>
    splitType === 'percentage' ? formatNumber(v / 100, { style: 'percent', minimumFractionDigits: 2, maximumFractionDigits: 2 }) : formatCurrency(v);

  const changeSplitType = (type: SplitType) => {
    setSplitType(type);
    setErrors((p) => ({ ...p, split: undefined }));
    if (type === 'equal') setSplitDetails({});
    else setSplitDetails(initialSplit(type, members, currentUserId, amountNum));
  };

  const validate = (): Errors => {
    const next: Errors = {};
    if (!(amountNum > 0)) next.amount = t('validation.amountPositive');
    if (!description.trim()) next.description = t('validation.descriptionRequired');
    if (!isSplitValid) next.split = t('validation.splitMismatch', { value: fmtSplit(splitDiff) });
    if (!expense && isRecurring) {
      if (!endDate) next.endDate = t('validation.endDateRequired');
      else if (endDate < date) next.endDate = t('validation.endDateAfterStart');
    }
    return next;
  };

  const doSubmit = async (chosenScope: Scope) => {
    setSaving(true);
    try {
      await onSubmit({
        data: {
          amount: amountNum,
          description: description.trim(),
          category,
          paidBy: expense ? expense.paidBy : currentUserId,
          status,
          splitType,
          splitDetails: splitType === 'equal' ? {} : splitDetails,
          // Calendar dates (YYYY-MM-DD): the server stores them at midday UTC so they show on
          // the same day in every timezone.
          dueDate: dueDate || null,
          date,
        },
        recurrence: !expense && isRecurring && endDate ? { frequency, endDate } : null,
        scope: chosenScope,
      });
      setScopeOpen(false);
    } catch {
      // Error already reported by the caller (toast); keep the form open.
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const next = validate();
    setErrors(next);
    if (Object.keys(next).length) {
      const firstInvalid = (e.currentTarget as HTMLFormElement).querySelector<HTMLElement>('[aria-invalid="true"]');
      firstInvalid?.focus();
      return;
    }
    if (expense?.isRecurring) {
      setScopeOpen(true);
      return;
    }
    doSubmit('this');
  };

  const title = expense ? t('group.editExpense') : t('group.addExpense');

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        dismissible={!saving}
        title={title}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={onClose} disabled={saving}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" form="expense-form" loading={saving && !scopeOpen}>
              {saving ? t('common.saving') : expense ? t('expense.update') : t('expense.save')}
            </Button>
          </>
        }
      >
        <form id="expense-form" onSubmit={handleSubmit} noValidate className="space-y-5 pb-2">
          <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,10rem)_1fr] gap-4">
            <TextField
              label={t('expense.amount')}
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              prefix={currencySymbol}
              className="tabular text-lg font-semibold"
              placeholder="0.00"
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value);
                if (errors.amount) setErrors((p) => ({ ...p, amount: undefined }));
              }}
              error={errors.amount}
              required
              data-autofocus
            />
            <TextField
              label={t('common.description')}
              placeholder={t('expense.descriptionPlaceholder')}
              value={description}
              maxLength={200}
              onChange={(e) => {
                setDescription(e.target.value);
                if (errors.description) setErrors((p) => ({ ...p, description: undefined }));
              }}
              error={errors.description}
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <FieldsetLabel id={categoryLabelId}>{t('common.category')}</FieldsetLabel>
            <div role="radiogroup" aria-labelledby={categoryLabelId} className="grid grid-cols-3 sm:grid-cols-5 gap-2">
              {CATEGORIES.map((cat) => {
                const { icon: Icon, color, bg } = categoryStyle(cat);
                const selected = category === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setCategory(cat)}
                    className={cn(
                      'flex flex-col items-center justify-center gap-1.5 min-h-16 p-2 rounded-control border transition-colors',
                      selected ? 'border-brand-500 ring-1 ring-brand-500 bg-brand-50 dark:bg-brand-500/15' : 'border-line hover:bg-surface-2',
                    )}
                  >
                    <span className={cn('flex size-8 items-center justify-center rounded-lg', bg, color)} aria-hidden="true">
                      <Icon className="size-4" />
                    </span>
                    <span className={cn('text-xs font-medium leading-tight text-center line-clamp-2 break-words max-w-full', selected ? 'text-fg' : 'text-fg-muted')}>{label(CATEGORY_KEYS, cat)}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <FieldsetLabel id={statusLabelId}>{t('expense.status')}</FieldsetLabel>
            <SegmentedControl<'paid' | 'pending'>
              fullWidth
              label={t('expense.status')}
              labelledBy={statusLabelId}
              value={status}
              onChange={setStatus}
              options={[
                { value: 'paid', label: t('status.paid') },
                { value: 'pending', label: t('status.pendingBill') },
              ]}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <TextField
              type="date"
              label={status === 'paid' ? t('expense.transactionDate') : t('expense.billDate')}
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
            <TextField type="date" label={t('expense.dueDateOptional')} value={dueDate} min={date} onChange={(e) => setDueDate(e.target.value)} />
          </div>

          <div className="flex flex-col gap-1.5">
            <FieldsetLabel id={splitLabelId}>{t('expense.splitType')}</FieldsetLabel>
            <SegmentedControl<SplitType>
              fullWidth
              label={t('expense.splitType')}
              labelledBy={splitLabelId}
              value={splitType}
              onChange={changeSplitType}
              options={(['equal', 'percentage', 'exact'] as const).map((type) => ({ value: type, label: label(SPLIT_KEYS, type) }))}
            />
          </div>

          {splitType !== 'equal' && (
            <div className="rounded-card border border-line bg-surface-2/50 p-3 sm:p-4 space-y-3">
              <p className="text-sm font-medium text-fg-muted">{t('expense.memberSplit')}</p>
              <ul className="space-y-2">
                {members.map((member) => (
                  <li key={member.uid} className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-2 min-w-0">
                      <Avatar name={member.displayName} size="sm" />
                      <span className="text-sm font-medium text-fg truncate">{member.displayName}</span>
                    </span>
                    <TextField
                      hideLabel
                      label={t('expense.memberShareLabel', { name: member.displayName ?? '' })}
                      containerClassName="w-32 shrink-0"
                      type="number"
                      inputMode="decimal"
                      step="0.01"
                      min="0"
                      className="text-right tabular pr-9"
                      placeholder="0.00"
                      value={splitDetails[member.uid] ?? ''}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        setSplitDetails((prev) => ({ ...prev, [member.uid]: val }));
                        setErrors((p) => ({ ...p, split: undefined }));
                      }}
                      suffix={<span className="pr-2.5 text-sm text-fg-subtle" aria-hidden="true">{splitType === 'percentage' ? '%' : currencySymbol}</span>}
                    />
                  </li>
                ))}
              </ul>
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-line">
                <span className="text-sm text-fg-muted tabular" aria-live="polite">
                  {t('expense.splitTotal', { value: fmtSplit(splitTotal) })}
                </span>
                <Button size="sm" variant="ghost" onClick={() => setSplitDetails(evenSplit(splitType, members, amountNum))}>
                  {t('expense.splitEvenly')}
                </Button>
              </div>
              {!isSplitValid && (
                <div className="flex flex-wrap items-center justify-between gap-2" role={errors.split ? 'alert' : undefined}>
                  <span className="text-sm font-medium text-red-700 dark:text-red-300">{errors.split ?? t('expense.mismatch', { value: fmtSplit(splitDiff) })}</span>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setSplitDetails((prev) => ({ ...prev, [currentUserId]: parseFloat(((prev[currentUserId] || 0) + splitDiff).toFixed(2)) }));
                      setErrors((p) => ({ ...p, split: undefined }));
                    }}
                  >
                    {t('expense.assignDifference')}
                  </Button>
                </div>
              )}
            </div>
          )}

          {!expense && (
            <div className="rounded-card border border-line p-3 sm:p-4 space-y-4">
              <label className="flex items-center gap-3 min-h-11 cursor-pointer">
                <input type="checkbox" checked={isRecurring} onChange={(e) => setIsRecurring(e.target.checked)} className="size-5 rounded accent-brand-600" />
                <span className="flex items-center gap-2 text-sm font-medium text-fg">
                  <Repeat className="size-4 text-fg-subtle" aria-hidden="true" />
                  {t('expense.setRecurring')}
                </span>
              </label>
              {isRecurring && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <SelectField label={t('expense.frequency')} value={frequency} onChange={(e) => setFrequency(e.target.value as RecurrenceFrequency)}>
                    <option value="daily">{t('recurrence.daily')}</option>
                    <option value="weekly">{t('recurrence.weekly')}</option>
                    <option value="monthly">{t('recurrence.monthly')}</option>
                    <option value="yearly">{t('recurrence.yearly')}</option>
                  </SelectField>
                  <TextField
                    type="date"
                    label={t('expense.endDate')}
                    value={endDate}
                    min={date}
                    onChange={(e) => {
                      setEndDate(e.target.value);
                      setErrors((p) => ({ ...p, endDate: undefined }));
                    }}
                    required
                    error={errors.endDate}
                    hint={t('expense.recurringLimitHint')}
                  />
                </div>
              )}
            </div>
          )}
        </form>
      </Modal>

      <ConfirmDialog
        open={scopeOpen}
        onClose={() => setScopeOpen(false)}
        onConfirm={() => doSubmit(scope)}
        loading={saving}
        tone="primary"
        icon={<Repeat className="size-5" />}
        title={t('updateSeries.title')}
        description={t('updateSeries.desc')}
        confirmLabel={t('common.confirm')}
      >
        <ScopeChoice mode="update" value={scope} onChange={setScope} />
      </ConfirmDialog>
    </>
  );
}
