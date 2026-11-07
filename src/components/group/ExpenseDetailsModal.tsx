import { Clock, Pencil, Repeat, Trash2 } from 'lucide-react';
import type { Expense, GroupMember } from '../../types';
import { useI18n, CATEGORY_KEYS, SPLIT_BADGE_KEYS, STATUS_KEYS } from '../../i18n';
import { CategoryIcon } from '../CategoryIcon';
import { Avatar, Badge, Button, Modal } from '../ui';

interface ExpenseDetailsModalProps {
  expense: Expense | null;
  members: GroupMember[];
  canEdit: boolean;
  onClose: () => void;
  onEdit: (expense: Expense) => void;
  onDelete: (expense: Expense) => void;
}

export function ExpenseDetailsModal({ expense, members, canEdit, onClose, onEdit, onDelete }: ExpenseDetailsModalProps) {
  const { t, label, formatCurrency, formatDate, formatNumber } = useI18n();
  const longDate = { month: 'long', day: 'numeric', year: 'numeric' } as const;

  return (
    <Modal
      open={!!expense}
      onClose={onClose}
      size="lg"
      title={expense?.description ?? ''}
      description={expense ? label(CATEGORY_KEYS, expense.category) : undefined}
      icon={expense ? <CategoryIcon category={expense.category} /> : undefined}
      footer={
        expense && canEdit ? (
          <>
            <Button variant="danger-soft" leftIcon={<Trash2 className="size-4" aria-hidden="true" />} onClick={() => onDelete(expense)}>
              {t('common.delete')}
            </Button>
            <Button leftIcon={<Pencil className="size-4" aria-hidden="true" />} onClick={() => onEdit(expense)}>
              {t('common.edit')}
            </Button>
          </>
        ) : undefined
      }
    >
      {expense && (
        <div className="space-y-6 pb-2">
          <div className="rounded-card bg-surface-2/60 border border-line p-5 text-center">
            <p className="text-3xl font-semibold font-display text-fg tabular">{formatCurrency(expense.amount)}</p>
            <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
              <Badge tone={expense.status === 'pending' ? 'warning' : 'success'}>{label(STATUS_KEYS, expense.status ?? 'paid')}</Badge>
              {expense.isRecurring && (
                <Badge tone="brand" icon={<Repeat />}>
                  {t('group.recurring')}
                </Badge>
              )}
            </div>
            <dl className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
              <div>
                <dt className="text-fg-subtle">{t('common.date')}</dt>
                <dd className="font-medium text-fg">{formatDate(expense.date.toDate(), longDate)}</dd>
              </div>
              {expense.dueDate && (
                <div>
                  <dt className="text-fg-subtle">{t('expense.dueDate')}</dt>
                  <dd className="font-medium text-fg flex items-center justify-center gap-1">
                    <Clock className="size-3.5" aria-hidden="true" />
                    {formatDate(expense.dueDate.toDate(), longDate)}
                  </dd>
                </div>
              )}
            </dl>
          </div>

          <section aria-labelledby="breakdown-title">
            <div className="flex items-center justify-between gap-2 mb-3">
              <h3 id="breakdown-title" className="text-sm font-semibold text-fg">
                {t('expenseDetails.breakdown')}
              </h3>
              <Badge>{label(SPLIT_BADGE_KEYS, expense.splitType)}</Badge>
            </div>
            <ul className="divide-y divide-line rounded-card border border-line">
              {members.map((member) => {
                let share = 0;
                let shareLabel = '';
                if (expense.splitType === 'percentage') {
                  const pct = expense.splitDetails?.[member.uid] || 0;
                  share = (pct / 100) * expense.amount;
                  shareLabel = t('split.percentShare', { pct: formatNumber(pct) });
                } else if (expense.splitType === 'exact') {
                  share = expense.splitDetails?.[member.uid] || 0;
                  shareLabel = t('split.exactAmount');
                } else {
                  // Shared by the people frozen on the expense (old expenses: current members).
                  const sharers = expense.participants?.length ? expense.participants : members.map((m) => m.uid);
                  share = sharers.includes(member.uid) ? expense.amount / sharers.length : 0;
                  shareLabel = t('split.equalShare');
                }
                const payer = member.uid === expense.paidBy;
                return (
                  <li key={member.uid} className="flex items-center justify-between gap-3 p-3">
                    <span className="flex items-center gap-3 min-w-0">
                      <Avatar name={member.displayName} size="sm" />
                      <span className="min-w-0">
                        <span className="flex items-center gap-2">
                          <span className="text-sm font-medium text-fg truncate">{member.displayName}</span>
                          {payer && <Badge tone="brand">{t('expenseDetails.paid')}</Badge>}
                        </span>
                        <span className="block text-xs text-fg-subtle">{shareLabel}</span>
                      </span>
                    </span>
                    <span className="text-right shrink-0">
                      <span className="block text-sm font-semibold text-fg tabular">{formatCurrency(share)}</span>
                      <span className="block text-xs text-fg-subtle">{payer ? t('expenseDetails.contributed') : t('expenseDetails.owes')}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        </div>
      )}
    </Modal>
  );
}
