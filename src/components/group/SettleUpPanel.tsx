import { useMemo, useState } from 'react';
import { ArrowRight, CircleCheck, HandCoins, History, Trash2 } from 'lucide-react';
import type { Expense, Group, GroupMember, Settlement } from '../../types';
import { useI18n } from '../../i18n';
import { settleUp, fromCents, type Transfer } from '../../utils/settle';
import { Avatar, Button, Card, ConfirmDialog, EmptyState, IconButton, SectionHeading, cn } from '../ui';
import type { PaymentDraft } from './RecordPaymentModal';

interface SettleUpPanelProps {
  group: Group;
  members: GroupMember[];
  expenses: Expense[];
  settlements: Settlement[];
  currentUserId: string;
  isAdmin: boolean;
  onRecord: (draft: PaymentDraft | null) => void;
  onDeleteSettlement: (s: Settlement) => Promise<void>;
}

const HISTORY_LIMIT = 5;

/** Who owes whom (minimised transfers) + recorded payments. */
export function SettleUpPanel({ group, members, expenses, settlements, currentUserId, isAdmin, onRecord, onDeleteSettlement }: SettleUpPanelProps) {
  const { t, formatCurrency, formatDate } = useI18n();
  const [showAll, setShowAll] = useState(false);
  const [toDelete, setToDelete] = useState<Settlement | null>(null);
  const [deleting, setDeleting] = useState(false);

  const memberIds = useMemo(() => (members.length ? members.map((m) => m.uid) : group.memberIds ?? []), [members, group.memberIds]);
  const { net, transfers } = useMemo(() => settleUp(expenses, settlements, memberIds), [expenses, settlements, memberIds]);
  const myNet = fromCents(net.get(currentUserId) ?? 0);

  /** `object`: lowercase form for mid-sentence use ("Carla paid you"). */
  const nameOf = (uid: string, object = false) => {
    if (uid === currentUserId) return object ? t('settle.youObject') : t('settle.youName');
    const m = members.find((x) => x.uid === uid);
    return m?.displayName || m?.email || t('settle.formerMember');
  };
  /** Real name for avatars (not "You"). */
  const avatarName = (uid: string) => {
    const m = members.find((x) => x.uid === uid);
    return m?.displayName || m?.email || '?';
  };
  const canAct = (tr: Transfer) => isAdmin || tr.from === currentUserId || tr.to === currentUserId;
  const history = showAll ? settlements : settlements.slice(0, HISTORY_LIMIT);

  return (
    <section aria-labelledby="settle-title">
      <SectionHeading
        id="settle-title"
        title={t('settle.title')}
        icon={<HandCoins className="size-5" />}
        action={
          members.length > 1 && (
            <Button size="sm" variant="secondary" onClick={() => onRecord(null)}>
              {t('settle.recordPayment')}
            </Button>
          )
        }
      />
      <Card padding="none">
        <div className="p-4 border-b border-line">
          <p className="eyebrow">{t('settle.yourBalance')}</p>
          <p
            className={cn(
              'mt-1 text-xl font-semibold font-display tabular',
              myNet > 0 ? 'text-emerald-700 dark:text-emerald-400' : myNet < 0 ? 'text-red-700 dark:text-red-400' : 'text-fg',
            )}
          >
            {myNet > 0
              ? t('settle.youAreOwedAmount', { amount: formatCurrency(myNet) })
              : myNet < 0
                ? t('settle.youOweAmount', { amount: formatCurrency(-myNet) })
                : t('settle.allSettled')}
          </p>
          <p className="mt-1 text-xs text-fg-subtle">{t('settle.explainer')}</p>
        </div>

        {transfers.length === 0 ? (
          <EmptyState compact icon={<CircleCheck />} title={t('settle.nothingToSettle')} description={t('settle.nothingToSettleHint')} />
        ) : (
          <ul className="divide-y divide-line" aria-label={t('settle.suggested')}>
            {transfers.map((tr) => {
              const mine = tr.from === currentUserId || tr.to === currentUserId;
              return (
                <li key={`${tr.from}-${tr.to}`} className={cn('flex items-center gap-3 p-3 sm:p-4', mine && 'bg-brand-50/50 dark:bg-brand-500/5')}>
                  <div className="flex items-center -space-x-2 shrink-0" aria-hidden="true">
                    <Avatar size="sm" name={avatarName(tr.from)} className="ring-2 ring-surface" />
                    <Avatar size="sm" name={avatarName(tr.to)} className="ring-2 ring-surface" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-fg">
                      <span className="font-semibold">{nameOf(tr.from)}</span>
                      <ArrowRight className="inline size-3.5 mx-1 text-fg-subtle" aria-hidden="true" />
                      <span className="sr-only"> {t('settle.pays')} </span>
                      <span className="font-semibold">{nameOf(tr.to)}</span>
                    </p>
                    <p className="text-sm font-semibold tabular text-fg-muted">{formatCurrency(tr.amount)}</p>
                  </div>
                  {canAct(tr) && (
                    <Button
                      size="sm"
                      variant={mine ? 'primary' : 'secondary'}
                      onClick={() => onRecord({ fromUser: tr.from, toUser: tr.to, amount: tr.amount })}
                      aria-label={t('settle.settleNamed', { from: nameOf(tr.from), to: nameOf(tr.to, true), amount: formatCurrency(tr.amount) })}
                    >
                      {t('settle.settle')}
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {settlements.length > 0 && (
          <div className="border-t border-line">
            <p className="flex items-center gap-2 px-4 pt-3 pb-1 text-xs font-semibold uppercase tracking-wide text-fg-subtle">
              <History className="size-3.5" aria-hidden="true" />
              {t('settle.history')}
            </p>
            <ul className="pb-2">
              {history.map((s) => {
                const canDelete = isAdmin || s.createdBy === currentUserId;
                return (
                  <li key={s.id} className="flex items-center gap-3 px-4 py-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-fg truncate">{t('settle.paidLine', { from: nameOf(s.fromUser), to: nameOf(s.toUser, true) })}</p>
                      <p className="text-xs text-fg-subtle truncate">
                        {formatDate(s.date.toDate(), { day: 'numeric', month: 'short', year: 'numeric' })}
                        {s.note ? ` · ${s.note}` : ''}
                      </p>
                    </div>
                    <span className="text-sm font-semibold tabular text-fg shrink-0">{formatCurrency(s.amount)}</span>
                    {canDelete && (
                      <IconButton size="sm" variant="danger" label={t('settle.deleteNamed', { from: nameOf(s.fromUser), to: nameOf(s.toUser, true) })} icon={<Trash2 className="size-4" />} onClick={() => setToDelete(s)} />
                    )}
                  </li>
                );
              })}
            </ul>
            {settlements.length > HISTORY_LIMIT && (
              <div className="px-4 pb-3">
                <Button size="sm" variant="ghost" onClick={() => setShowAll((v) => !v)} aria-expanded={showAll}>
                  {showAll ? t('settle.showLess') : t('settle.showAll', { count: settlements.length })}
                </Button>
              </div>
            )}
          </div>
        )}
      </Card>

      <ConfirmDialog
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        loading={deleting}
        title={t('settle.deleteTitle')}
        description={t('settle.deleteDesc')}
        confirmLabel={t('common.delete')}
        icon={<Trash2 className="size-5" />}
        onConfirm={async () => {
          if (!toDelete) return;
          setDeleting(true);
          try {
            await onDeleteSettlement(toDelete);
            setToDelete(null);
          } catch {
            // reported by caller
          } finally {
            setDeleting(false);
          }
        }}
      />
    </section>
  );
}
