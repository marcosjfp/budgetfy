import { ArrowLeft, Bell, Calendar, Plus, Settings2, UserPlus, AlertCircle } from 'lucide-react';
import type { Expense, Group } from '../../types';
import { useI18n, GROUP_TYPE_KEYS } from '../../i18n';
import { Badge, Button, IconButton, Popover, EmptyState, cn } from '../ui';

interface GroupHeaderProps {
  group: Group;
  periodLabel: string;
  isAdmin: boolean;
  upcoming: Expense[];
  onBack: () => void;
  onOpenSettings: () => void;
  onInvite: () => void;
  onAddExpense: () => void;
  onViewExpense: (e: Expense) => void;
}

export function GroupHeader({ group, periodLabel, isAdmin, upcoming, onBack, onOpenSettings, onInvite, onAddExpense, onViewExpense }: GroupHeaderProps) {
  const { t, label, formatCurrency, formatDate } = useI18n();
  const notificationsLabel = upcoming.length > 0 ? t('group.notificationsCount', { count: upcoming.length }) : t('group.notifications');

  return (
    <header className="mb-6 sm:mb-8">
      <Button variant="ghost" size="sm" onClick={onBack} leftIcon={<ArrowLeft className="size-4" aria-hidden="true" />} className="-ml-3 mb-4">
        {t('group.back')}
      </Button>

      <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span
              className="inline-flex items-center gap-1.5 rounded-full border border-line px-2 py-0.5 text-xs font-medium text-fg-muted bg-surface"
            >
              <span aria-hidden="true" className="size-2 rounded-full" style={{ backgroundColor: group.themeColor || 'var(--color-brand-500)' }} />
              {label(GROUP_TYPE_KEYS, group.type)}
            </span>
            <Badge icon={<Calendar />}>{periodLabel}</Badge>
          </div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-fg font-display break-words">{group.name}</h1>
          <p className={cn('mt-1 max-w-2xl', group.description ? 'text-fg-muted' : 'text-fg-subtle italic')}>{group.description || t('group.noDescription')}</p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Popover
            label={t('group.upcomingBills')}
            panelClassName="w-80"
            trigger={(props) => (
              <button
                type="button"
                {...props}
                aria-label={notificationsLabel}
                title={notificationsLabel}
                className="relative inline-flex size-11 items-center justify-center rounded-control border border-line-strong bg-surface text-fg-muted hover:text-fg hover:bg-surface-2 shadow-card transition-colors"
              >
                <Bell className={cn('size-5', upcoming.length > 0 && 'text-amber-600 dark:text-amber-400')} aria-hidden="true" />
                {upcoming.length > 0 && (
                  <span aria-hidden="true" className="absolute -top-1.5 -right-1.5 min-w-5 h-5 px-1 rounded-full bg-amber-600 text-white text-xs font-semibold flex items-center justify-center ring-2 ring-surface">
                    {upcoming.length}
                  </span>
                )}
              </button>
            )}
          >
            {(close) => (
              <div>
                <div className="px-4 pt-4 pb-3 border-b border-line">
                  <p className="text-sm font-semibold text-fg">{t('group.upcomingBills')}</p>
                  <p className="text-xs text-fg-subtle">{t('group.dueWithin3Days')}</p>
                </div>
                {upcoming.length === 0 ? (
                  <EmptyState compact icon={<Bell />} title={t('group.noUpcomingBills')} />
                ) : (
                  <ul className="max-h-80 overflow-y-auto p-1.5">
                    {upcoming.map((e) => (
                      <li key={e.id}>
                        <button
                          type="button"
                          onClick={() => {
                            close();
                            onViewExpense(e);
                          }}
                          className="w-full flex items-start justify-between gap-3 p-2.5 rounded-control hover:bg-surface-2 text-left"
                        >
                          <span className="min-w-0">
                            <span className="block text-sm font-medium text-fg truncate">{e.description}</span>
                            <span className="flex items-center gap-1 text-xs text-amber-800 dark:text-amber-300">
                              <AlertCircle className="size-3" aria-hidden="true" />
                              {e.dueDate && t('common.due', { date: formatDate(e.dueDate.toDate()) })}
                            </span>
                          </span>
                          <span className="text-sm font-semibold text-fg tabular">{formatCurrency(e.amount)}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </Popover>
          {isAdmin && <IconButton variant="secondary" label={t('group.settings')} icon={<Settings2 className="size-5" />} onClick={onOpenSettings} />}
          {isAdmin && (
            <Button variant="secondary" onClick={onInvite} leftIcon={<UserPlus className="size-4" aria-hidden="true" />}>
              <span className="hidden sm:inline">{t('group.invite')}</span>
              <span className="sr-only sm:hidden">{t('group.invite')}</span>
            </Button>
          )}
          <Button onClick={onAddExpense} leftIcon={<Plus className="size-4" aria-hidden="true" />} className="flex-1 sm:flex-none">
            {t('group.addExpense')}
          </Button>
        </div>
      </div>
    </header>
  );
}
