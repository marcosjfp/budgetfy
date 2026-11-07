import React, { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { Users, Receipt, ArrowRight, Plus, Pencil, Trash2, Clock, AlertTriangle, CircleCheck, Wallet, CalendarClock, FolderPlus, HandCoins } from 'lucide-react';
import type { User } from 'firebase/auth';
import { CATEGORIES, type Group, type Settlement } from '../types';
import { useI18n, CurrencyScope, CATEGORY_KEYS, BUDGET_PERIOD_KEYS, type Currency } from '../i18n';
import { deleteWithUndo } from '../utils/undo';
import { fromCents, settleUp } from '../utils/settle';
import { handleFirestoreError, OperationType } from '../utils/errorHandling';
import { apiFetch } from '../api';
import {
  effectiveDueDate,
  fromDateInputValue,
  groupCurrency,
  isDateInCurrentPeriod,
  isOverdue,
  toDateInputValue,
  type GroupExpense,
} from '../utils/budget';
import { CategoryIcon, GroupDot } from './CategoryIcon';
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  IconButton,
  LoadingRegion,
  Modal,
  SectionHeading,
  SelectField,
  Skeleton,
  SkeletonRows,
  TextField,
  cn,
  toast,
} from './ui';

interface DashboardProps {
  user: User;
  groups: Group[];
  expenses: GroupExpense[];
  settlements: Settlement[];
  loading: boolean;
  onSelectGroup: (id: string) => void;
  onCreateGroup: () => void;
  onChanged: () => void;
}

interface BudgetAlert {
  groupId: string;
  groupName: string;
  budgetType: NonNullable<Group['budgetType']>;
  spent: number;
  limit: number;
  currency: Currency;
}

interface GroupBalance {
  groupId: string;
  groupName: string;
  currency: Currency;
  /** Positive: you are owed; negative: you owe. */
  amount: number;
}

type Totals = Map<Currency, number>;

function addTo(totals: Totals, currency: Currency, amount: number) {
  totals.set(currency, (totals.get(currency) ?? 0) + amount);
}

export default function Dashboard({ user, groups, expenses, settlements, loading, onSelectGroup, onCreateGroup, onChanged }: DashboardProps) {
  const { t, tRich, label, formatCurrency, formatDate, capitalize, currency: preferredCurrency } = useI18n();
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  const [isGroupsListOpen, setIsGroupsListOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<GroupExpense | null>(null);
  const [expenseToDelete, setExpenseToDelete] = useState<GroupExpense | null>(null);

  const visible = useMemo(() => expenses.filter((e) => !hiddenIds.has(e.id)), [expenses, hiddenIds]);
  const groupName = (id: string) => groups.find((g) => g.id === id)?.name ?? '';
  const currencyOf = (id: string) => groupCurrency(groups.find((g) => g.id === id), preferredCurrency);
  const money = (amount: number, groupId: string) => formatCurrency(amount, { currency: currencyOf(groupId) });
  /** Totals per currency (no FX conversion): "R$ 10,00 · US$ 5.00"; the preferred currency first. */
  const formatTotals = (totals: Totals) => {
    const entries = [...totals.entries()].filter(([, v]) => Math.abs(v) >= 0.005);
    if (entries.length === 0) return formatCurrency(0);
    entries.sort(([a], [b]) => (a === preferredCurrency ? -1 : b === preferredCurrency ? 1 : a.localeCompare(b)));
    return entries.map(([c, v]) => formatCurrency(v, { currency: c })).join(' · ');
  };

  const stats = useMemo(() => {
    const now = new Date();
    const cur = (id: string) => groupCurrency(groups.find((g) => g.id === id), preferredCurrency);
    const monthSpent: Totals = new Map();
    visible.filter((e) => isDateInCurrentPeriod(e.date.toDate(), 'monthly', now)).forEach((e) => addTo(monthSpent, cur(e.groupId), e.amount));
    const pending = visible.filter((e) => e.status === 'pending');
    const pendingTotal: Totals = new Map();
    pending.forEach((e) => addTo(pendingTotal, cur(e.groupId), e.amount));
    const overdue = pending.filter((e) => isOverdue(e, now)).length;
    const dueItems = [...pending].sort((a, b) => effectiveDueDate(a).getTime() - effectiveDueDate(b).getTime()).slice(0, 4);

    const alerts: BudgetAlert[] = [];
    groups.forEach((g) => {
      if (!g.maxBudget) return;
      const type = g.budgetType || 'total';
      const spent = visible
        .filter((e) => e.groupId === g.id && isDateInCurrentPeriod(e.date.toDate(), type, now))
        .reduce((s, e) => s + e.amount, 0);
      if (spent > g.maxBudget) alerts.push({ groupId: g.id, groupName: g.name, budgetType: type, spent, limit: g.maxBudget, currency: cur(g.id) });
    });

    // Settle-up balances per group (same rules as the group page), totals per currency.
    const balances: GroupBalance[] = [];
    const owe: Totals = new Map();
    const owed: Totals = new Map();
    groups.forEach((g) => {
      const { net } = settleUp(
        visible.filter((e) => e.groupId === g.id),
        settlements.filter((s) => s.groupId === g.id),
        g.memberIds ?? [],
      );
      const amount = fromCents(net.get(user.uid) ?? 0);
      if (amount === 0) return;
      const currency = cur(g.id);
      balances.push({ groupId: g.id, groupName: g.name, currency, amount });
      addTo(amount > 0 ? owed : owe, currency, Math.abs(amount));
    });
    balances.sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));

    return { monthSpent, pendingCount: pending.length, pendingTotal, overdue, dueItems, alerts, recent: visible.slice(0, 8), balances, owe, owed };
  }, [visible, groups, settlements, preferredCurrency, user.uid]);

  const handleDeleteExpense = () => {
    if (!expenseToDelete) return;
    const target = expenseToDelete;
    const unhide = () =>
      setHiddenIds((prev) => {
        const next = new Set(prev);
        next.delete(target.id);
        return next;
      });
    // Optimistic: hide immediately; the request is sent after the 5 s undo window.
    setHiddenIds((prev) => new Set(prev).add(target.id));
    setExpenseToDelete(null);
    deleteWithUndo({
      title: t('toast.expenseDeleted'),
      description: target.description,
      commit: () => apiFetch(`/groups/${target.groupId}/expenses/${target.id}`, { method: 'DELETE' }),
      onUndo: unhide,
      onError: (error) => {
        unhide();
        handleFirestoreError(error, OperationType.DELETE, `groups/${target.groupId}/expenses/${target.id}`);
      },
      onCommitted: onChanged,
    });
  };

  const firstName = user.displayName?.split(' ')[0] ?? '';
  const today = capitalize(formatDate(new Date(), { weekday: 'long', day: 'numeric', month: 'long' }));
  const hasGroups = groups.length > 0;

  const kpis: {
    key: string;
    label: string;
    value: string;
    sub?: React.ReactNode;
    icon: React.ReactNode;
    tone: 'brand' | 'neutral' | 'warning' | 'danger' | 'success';
    onClick?: () => void;
    actionLabel?: string;
  }[] = [
    {
      key: 'month',
      label: t('dashboard.kpi.thisMonth'),
      value: formatTotals(stats.monthSpent),
      sub: capitalize(formatDate(new Date(), { month: 'long', year: 'numeric' })),
      icon: <Wallet className="size-5" />,
      tone: 'brand',
    },
    {
      key: 'pending',
      label: t('dashboard.kpi.pending'),
      value: formatTotals(stats.pendingTotal),
      sub:
        stats.overdue > 0 ? (
          <span className="text-red-700 dark:text-red-300 font-medium">{t('dashboard.kpi.overdueCount', { count: stats.overdue })}</span>
        ) : (
          t('dashboard.kpi.billsCount', { count: stats.pendingCount })
        ),
      icon: <CalendarClock className="size-5" />,
      tone: stats.overdue > 0 ? 'danger' : stats.pendingCount > 0 ? 'warning' : 'neutral',
    },
    {
      key: 'groups',
      label: t('dashboard.activeGroups'),
      value: String(groups.length),
      icon: <Users className="size-5" />,
      tone: 'neutral',
      onClick: hasGroups ? () => (groups.length === 1 ? onSelectGroup(groups[0].id) : setIsGroupsListOpen(true)) : undefined,
      actionLabel: t('dashboard.selectGroup'),
    },
    {
      key: 'alerts',
      label: t('dashboard.activeAlerts'),
      value: String(stats.alerts.length),
      sub: stats.alerts.length === 0 ? t('dashboard.allOnTrack') : undefined,
      icon: stats.alerts.length > 0 ? <AlertTriangle className="size-5" /> : <CircleCheck className="size-5" />,
      tone: stats.alerts.length > 0 ? 'danger' : 'success',
      onClick: stats.alerts.length > 0 ? () => onSelectGroup(stats.alerts[0].groupId) : undefined,
      actionLabel: stats.alerts[0] ? stats.alerts[0].groupName : undefined,
    },
  ];

  const toneIcon: Record<string, string> = {
    brand: 'bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-200',
    neutral: 'bg-surface-2 text-fg-muted',
    warning: 'bg-amber-50 text-amber-800 dark:bg-amber-500/15 dark:text-amber-200',
    danger: 'bg-red-50 text-red-700 dark:bg-red-500/15 dark:text-red-200',
    success: 'bg-emerald-50 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-200',
  };

  return (
    <div>
      <header className="mb-6 sm:mb-8 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="eyebrow mb-1">{today}</p>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-fg font-display">
            {tRich('dashboard.welcomeBack', { name: <span className="text-brand-700 dark:text-brand-300">{firstName}</span> })}
          </h1>
          <p className="mt-1 text-fg-muted">{t('dashboard.subtitle')}</p>
        </div>
        <Button leftIcon={<Plus className="size-4" aria-hidden="true" />} onClick={onCreateGroup} className="w-full sm:w-auto">
          {t('dashboard.createGroup')}
        </Button>
      </header>

      {/* Key numbers first */}
      {loading ? (
        <LoadingRegion label={t('common.loading')} className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 mb-8">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="rounded-card border border-line bg-surface p-4 sm:p-5 space-y-3" aria-hidden="true">
              <Skeleton className="size-9 rounded-lg" />
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-7 w-28" />
            </div>
          ))}
        </LoadingRegion>
      ) : (
        <ul className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 mb-8" aria-label={t('dashboard.kpi.summary')}>
          {kpis.map((k, i) => {
            const content = (
              <>
                <span className={cn('flex size-9 items-center justify-center rounded-lg mb-3', toneIcon[k.tone])} aria-hidden="true">
                  {k.icon}
                </span>
                <span className="block eyebrow">{k.label}</span>
                <span className={cn('mt-1 block font-semibold font-display tracking-tight text-fg tabular break-words', i === 0 ? 'text-2xl sm:text-3xl' : 'text-xl sm:text-2xl')}>
                  {k.value}
                </span>
                {k.sub && <span className="mt-1 block text-sm text-fg-subtle truncate">{k.sub}</span>}
              </>
            );
            return (
              <li key={k.key} className={cn(i === 0 && 'col-span-2 sm:col-span-3 xl:col-span-1', i === 1 && 'col-span-2 sm:col-span-1')}>
                {k.onClick ? (
                  <Card as="button" type="button" interactive onClick={k.onClick} className="w-full h-full p-4 sm:p-5" padding="none" aria-label={`${k.label}: ${k.value}. ${k.actionLabel ?? ''}`}>
                    {content}
                  </Card>
                ) : (
                  <Card className={cn('h-full p-4 sm:p-5', i === 0 && 'border-brand-200 dark:border-brand-500/30')} padding="none">
                    {content}
                  </Card>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {!loading && !hasGroups ? (
        <Card padding="lg">
          <EmptyState
            icon={<FolderPlus />}
            title={t('dashboard.empty.title')}
            description={t('dashboard.empty.description')}
            action={
              <Button leftIcon={<Plus className="size-4" aria-hidden="true" />} onClick={onCreateGroup}>
                {t('dashboard.empty.cta')}
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 lg:gap-8">
          <div className="xl:col-span-2 space-y-8 min-w-0">
            {!loading && stats.dueItems.length > 0 && (
              <section aria-labelledby="dash-due">
                <SectionHeading id="dash-due" title={t('dashboard.upcomingDue')} icon={<Clock className="size-5" />} />
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {stats.dueItems.map((item) => {
                    const due = effectiveDueDate(item);
                    const overdue = isOverdue(item);
                    return (
                      <li key={item.id}>
                        <Card
                          as="button"
                          type="button"
                          interactive
                          padding="none"
                          onClick={() => onSelectGroup(item.groupId)}
                          className={cn('w-full p-4', overdue && 'border-red-200 dark:border-red-500/30')}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="font-semibold text-fg truncate">{item.description}</p>
                              <p className="text-sm text-fg-subtle truncate">{t('common.inGroup', { group: groupName(item.groupId) })}</p>
                            </div>
                            <Badge tone={overdue ? 'danger' : 'warning'} icon={overdue ? <AlertTriangle /> : <Clock />}>
                              {overdue ? t('dashboard.overdue') : t('dashboard.dueSoon')}
                            </Badge>
                          </div>
                          <div className="mt-3 flex items-end justify-between gap-3">
                            <p className="text-sm text-fg-muted">{t('common.due', { date: formatDate(due, { day: 'numeric', month: 'short' }) })}</p>
                            <p className="text-lg font-semibold text-fg tabular">{money(item.amount, item.groupId)}</p>
                          </div>
                        </Card>
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}

            <section aria-labelledby="dash-recent">
              <SectionHeading id="dash-recent" title={t('dashboard.recentActivity')} />
              <Card padding="none" className="overflow-hidden">
                {loading ? (
                  <LoadingRegion label={t('common.loading')}>
                    <SkeletonRows rows={4} />
                  </LoadingRegion>
                ) : stats.recent.length === 0 ? (
                  <EmptyState
                    icon={<Receipt />}
                    title={t('dashboard.noRecent')}
                    description={t('dashboard.noRecentHint')}
                    action={
                      groups[0] && (
                        <Button variant="secondary" onClick={() => onSelectGroup(groups[0].id)} rightIcon={<ArrowRight className="size-4" aria-hidden="true" />}>
                          {t('dashboard.openGroup', { name: groups[0].name })}
                        </Button>
                      )
                    }
                  />
                ) : (
                  <ul className="divide-y divide-line">
                    {stats.recent.map((expense) => {
                      const mine = expense.paidBy === user.uid;
                      return (
                        <li key={expense.id} className="group flex items-center gap-3 sm:gap-4 p-3 sm:p-4 hover:bg-surface-2/60 transition-colors">
                          <CategoryIcon category={expense.category} />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-fg truncate">{expense.description}</p>
                            <p className="text-sm text-fg-subtle truncate">
                              {formatDate(expense.date.toDate(), { month: 'short', day: 'numeric' })} · {label(CATEGORY_KEYS, expense.category)} ·{' '}
                              {groupName(expense.groupId)}
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="font-semibold text-fg tabular">{money(expense.amount, expense.groupId)}</p>
                            <p className="text-xs text-fg-subtle">
                              {expense.status === 'pending' ? (
                                <span className="text-amber-800 dark:text-amber-300 font-medium">{t('common.pending')}</span>
                              ) : mine ? (
                                t('dashboard.youPaid')
                              ) : (
                                t('dashboard.someonePaid')
                              )}
                            </p>
                          </div>
                          {mine && (
                            <div className="flex items-center shrink-0 -mr-1 pointer-fine:opacity-0 pointer-fine:group-hover:opacity-100 pointer-fine:group-focus-within:opacity-100 transition-opacity">
                              <IconButton size="sm" label={t('dashboard.editExpense')} icon={<Pencil className="size-4" />} onClick={() => setEditingExpense(expense)} />
                              <IconButton size="sm" variant="danger" label={t('dashboard.deleteExpense')} icon={<Trash2 className="size-4" />} onClick={() => setExpenseToDelete(expense)} />
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </Card>
            </section>
          </div>

          <div className="space-y-8 min-w-0">
          <section aria-labelledby="dash-balances" className="min-w-0">
            <SectionHeading id="dash-balances" title={t('dashboard.balances')} icon={<HandCoins className="size-5" />} />
            {loading ? (
              <Card>
                <Skeleton className="h-16 w-full" />
              </Card>
            ) : (
              <Card padding="none">
                <dl className="grid grid-cols-2 divide-x divide-line border-b border-line">
                  <div className="p-4 min-w-0">
                    <dt className="eyebrow">{t('dashboard.youOwe')}</dt>
                    <dd className={cn('mt-1 font-semibold font-display tabular break-words', stats.owe.size ? 'text-red-700 dark:text-red-400' : 'text-fg')}>
                      {formatTotals(stats.owe)}
                    </dd>
                  </div>
                  <div className="p-4 min-w-0">
                    <dt className="eyebrow">{t('dashboard.youAreOwed')}</dt>
                    <dd className={cn('mt-1 font-semibold font-display tabular break-words', stats.owed.size ? 'text-emerald-700 dark:text-emerald-400' : 'text-fg')}>
                      {formatTotals(stats.owed)}
                    </dd>
                  </div>
                </dl>
                {stats.balances.length === 0 ? (
                  <EmptyState compact icon={<CircleCheck />} title={t('dashboard.allSettled')} description={t('dashboard.allSettledHint')} />
                ) : (
                  <ul className="p-1.5">
                    {stats.balances.map((b) => (
                      <li key={b.groupId}>
                        <button
                          type="button"
                          onClick={() => onSelectGroup(b.groupId)}
                          className="w-full flex items-center justify-between gap-3 min-h-11 px-2.5 py-2 rounded-control hover:bg-surface-2 text-left transition-colors"
                        >
                          <span className="min-w-0">
                            <span className="block text-sm font-medium text-fg truncate">{b.groupName}</span>
                            <span className="block text-xs text-fg-subtle">{b.amount > 0 ? t('dashboard.owesYou') : t('dashboard.youOweGroup')}</span>
                          </span>
                          <span className={cn('text-sm font-semibold tabular shrink-0', b.amount > 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400')}>
                            {formatCurrency(Math.abs(b.amount), { currency: b.currency })}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            )}
          </section>

          <section aria-labelledby="dash-alerts" className="min-w-0">
            <SectionHeading id="dash-alerts" title={t('dashboard.budgetAlerts')} />
            {loading ? (
              <Card>
                <Skeleton className="h-16 w-full" />
              </Card>
            ) : stats.alerts.length === 0 ? (
              <Card>
                <EmptyState compact icon={<CircleCheck />} title={t('dashboard.allOnTrack')} description={t('dashboard.allOnTrackHint')} />
              </Card>
            ) : (
              <ul className="space-y-3">
                {stats.alerts.map((alert) => (
                  <motion.li key={alert.groupId} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
                    <Card as="button" type="button" interactive padding="none" onClick={() => onSelectGroup(alert.groupId)} className="w-full p-4 border-red-200 dark:border-red-500/30">
                      <div className="flex items-start gap-3">
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-red-50 text-red-700 dark:bg-red-500/15 dark:text-red-200" aria-hidden="true">
                          <AlertTriangle className="size-5" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-fg">
                            {t('dashboard.overBudget', {
                              name: alert.groupName,
                              period: label(BUDGET_PERIOD_KEYS, alert.budgetType),
                              spent: formatCurrency(alert.spent, { currency: alert.currency }),
                              limit: formatCurrency(alert.limit, { currency: alert.currency }),
                            })}
                          </p>
                          <div className="mt-2 h-1.5 rounded-full bg-red-100 dark:bg-red-500/20 overflow-hidden" aria-hidden="true">
                            <div className="h-full w-full bg-red-600" />
                          </div>
                        </div>
                      </div>
                    </Card>
                  </motion.li>
                ))}
              </ul>
            )}
          </section>
          </div>
        </div>
      )}

      <Modal open={isGroupsListOpen} onClose={() => setIsGroupsListOpen(false)} title={t('dashboard.selectGroup')} size="sm">
        <ul className="space-y-1 pb-2">
          {groups.map((group) => (
            <li key={group.id}>
              <button
                type="button"
                onClick={() => {
                  setIsGroupsListOpen(false);
                  onSelectGroup(group.id);
                }}
                className="group w-full flex items-center gap-3 min-h-12 px-3 rounded-control hover:bg-surface-2 text-left transition-colors"
              >
                <GroupDot type={group.type} color={group.themeColor} />
                <span className="flex-1 font-medium text-fg truncate">{group.name}</span>
                <ArrowRight className="size-4 text-fg-subtle motion-safe:group-hover:translate-x-0.5 transition-transform" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      </Modal>

      <CurrencyScope currency={editingExpense ? currencyOf(editingExpense.groupId) : null}>
        <EditExpenseModal
          expense={editingExpense}
          onClose={() => setEditingExpense(null)}
          onSaved={() => {
            setEditingExpense(null);
            toast.success(t('toast.expenseUpdated'));
            onChanged();
          }}
        />
      </CurrencyScope>

      <ConfirmDialog
        open={!!expenseToDelete}
        onClose={() => setExpenseToDelete(null)}
        onConfirm={handleDeleteExpense}
        title={t('dashboard.deleteTitle')}
        description={t('dashboard.deleteConfirm')}
        confirmLabel={t('common.delete')}
        icon={<Trash2 className="size-5" />}
      />
    </div>
  );
}

function EditExpenseModal({ expense, onClose, onSaved }: { expense: GroupExpense | null; onClose: () => void; onSaved: () => void }) {
  const { t, label, currencySymbol } = useI18n();
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [date, setDate] = useState(toDateInputValue(new Date()));
  const [errors, setErrors] = useState<{ amount?: string; description?: string }>({});
  const [saving, setSaving] = useState(false);
  const [loadedId, setLoadedId] = useState<string | null>(null);

  // Load the expense into the form when a new one is opened.
  if (expense && expense.id !== loadedId) {
    setLoadedId(expense.id);
    setAmount(expense.amount.toString());
    setDescription(expense.description);
    setCategory(expense.category);
    setDate(toDateInputValue(expense.date.toDate()));
    setErrors({});
  }
  if (!expense && loadedId !== null) setLoadedId(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expense) return;
    const next: typeof errors = {};
    if (!(parseFloat(amount) > 0)) next.amount = t('validation.amountPositive');
    if (!description.trim()) next.description = t('validation.descriptionRequired');
    setErrors(next);
    if (Object.keys(next).length) return;
    setSaving(true);
    try {
      await apiFetch(`/groups/${expense.groupId}/expenses/${expense.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          amount: parseFloat(amount),
          description: description.trim(),
          category,
          date: fromDateInputValue(date).toISOString(),
        }),
      });
      onSaved();
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `groups/${expense.groupId}/expenses/${expense.id}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={!!expense}
      onClose={onClose}
      dismissible={!saving}
      title={t('dashboard.editExpense')}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" form="dash-edit-expense" loading={saving}>
            {t('common.saveChanges')}
          </Button>
        </>
      }
    >
      <form id="dash-edit-expense" onSubmit={submit} noValidate className="space-y-4 pb-2">
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
        <TextField
          label={t('common.description')}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={t('dashboard.descriptionPlaceholder')}
          error={errors.description}
          required
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <SelectField label={t('common.category')} value={category} onChange={(e) => setCategory(e.target.value)}>
            {CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {label(CATEGORY_KEYS, cat)}
              </option>
            ))}
          </SelectField>
          <TextField label={t('common.date')} type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </div>
      </form>
    </Modal>
  );
}
