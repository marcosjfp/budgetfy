import { Pencil, Receipt, Repeat, Trash2 } from 'lucide-react';
import type { Expense } from '../../types';
import { useI18n, CATEGORY_KEYS, STATUS_KEYS } from '../../i18n';
import { Badge, Button, IconButton, Modal } from '../ui';
import { sumBy } from './groupMath';

interface SeriesManagerModalProps {
  recurrenceId: string | null;
  expenses: Expense[];
  onClose: () => void;
  onEditSeries: (first: Expense) => void;
  onDeleteSeries: (first: Expense) => void;
  onViewInstance: (expense: Expense) => void;
  onEditInstance: (expense: Expense) => void;
}

export function SeriesManagerModal({ recurrenceId, expenses, onClose, onEditSeries, onDeleteSeries, onViewInstance, onEditInstance }: SeriesManagerModalProps) {
  const { t, label, formatCurrency, formatDate } = useI18n();
  const series = recurrenceId ? expenses.filter((e) => e.recurrenceId === recurrenceId) : [];
  const first = series[0];
  const sorted = [...series].sort((a, b) => a.date.toMillis() - b.date.toMillis());

  return (
    <Modal
      open={!!recurrenceId && !!first}
      onClose={onClose}
      size="xl"
      title={t('series.manageTitle')}
      description={first ? `${first.description} · ${t('series.perPeriod', { amount: formatCurrency(first.amount) })}` : undefined}
      icon={
        <span className="flex size-10 items-center justify-center rounded-xl bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-200">
          <Repeat className="size-5" />
        </span>
      }
      footer={
        first ? (
          <>
            <Button variant="danger-soft" leftIcon={<Trash2 className="size-4" aria-hidden="true" />} onClick={() => onDeleteSeries(first)}>
              {t('series.deleteAll')}
            </Button>
            <Button leftIcon={<Pencil className="size-4" aria-hidden="true" />} onClick={() => onEditSeries(first)}>
              {t('series.editAll')}
            </Button>
          </>
        ) : undefined
      }
    >
      {first && (
        <div className="space-y-5 pb-2">
          <dl className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="rounded-control bg-surface-2/60 border border-line p-3">
              <dt className="text-xs text-fg-subtle">{t('common.category')}</dt>
              <dd className="text-sm font-semibold text-fg">{label(CATEGORY_KEYS, first.category)}</dd>
            </div>
            <div className="rounded-control bg-surface-2/60 border border-line p-3">
              <dt className="text-xs text-fg-subtle">{t('series.occurrences')}</dt>
              <dd className="text-sm font-semibold text-fg tabular">{series.length}</dd>
            </div>
            <div className="rounded-control bg-surface-2/60 border border-line p-3 col-span-2 sm:col-span-1">
              <dt className="text-xs text-fg-subtle">{t('series.totalValue')}</dt>
              <dd className="text-sm font-semibold text-fg tabular">{formatCurrency(sumBy(series, (e) => e.amount))}</dd>
            </div>
          </dl>

          <section aria-labelledby="series-instances">
            <h3 id="series-instances" className="text-sm font-semibold text-fg mb-2">
              {t('series.instances', { count: series.length })}
            </h3>
            <ul className="divide-y divide-line rounded-card border border-line">
              {sorted.map((instance) => (
                <li key={instance.id} className="flex items-center justify-between gap-3 p-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-fg">{formatDate(instance.date.toDate(), { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                    <div className="mt-0.5 flex flex-wrap items-center gap-2">
                      <Badge tone={instance.status === 'pending' ? 'warning' : 'success'}>{label(STATUS_KEYS, instance.status ?? 'paid')}</Badge>
                      {instance.dueDate && <span className="text-xs text-fg-subtle">{t('common.due', { date: formatDate(instance.dueDate.toDate()) })}</span>}
                    </div>
                  </div>
                  <div className="flex items-center shrink-0">
                    <IconButton size="sm" label={t('series.viewTransaction')} icon={<Receipt className="size-4" />} onClick={() => onViewInstance(instance)} />
                    <IconButton size="sm" label={t('series.editInstance')} icon={<Pencil className="size-4" />} onClick={() => onEditInstance(instance)} />
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}
    </Modal>
  );
}
