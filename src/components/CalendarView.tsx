import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, CalendarDays, CircleCheck, AlertTriangle, Clock } from 'lucide-react';
import type { Group } from '../types';
import { useI18n } from '../i18n';
import { groupCurrency, effectiveDueDate, type GroupExpense } from '../utils/budget';
import { CategoryIcon } from './CategoryIcon';
import { Badge, Button, Card, EmptyState, IconButton, LoadingRegion, Skeleton, cn } from './ui';

interface CalendarViewProps {
  expenses: GroupExpense[];
  groups: Group[];
  loading?: boolean;
  onSelectGroup: (id: string) => void;
}

const sameDay = (a: Date, b: Date) => a.getDate() === b.getDate() && a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear();
const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

export default function CalendarView({ expenses, groups, loading, onSelectGroup }: CalendarViewProps) {
  const { t, formatCurrency, formatDate, capitalize, currency: preferredCurrency } = useI18n();
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [selectedDay, setSelectedDay] = useState<Date>(() => new Date());
  const today = new Date();

  // Localised weekday names, Sunday first (Jan 1 2023 was a Sunday).
  const weekdays = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        const d = new Date(2023, 0, 1 + i);
        return {
          short: capitalize(formatDate(d, { weekday: 'short' }).replace(/\.$/, '')),
          narrow: formatDate(d, { weekday: 'narrow' }).toUpperCase(),
          long: capitalize(formatDate(d, { weekday: 'long' })),
        };
      }),
    [formatDate, capitalize],
  );

  const days = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const first = new Date(year, month, 1);
    const result: { date: Date; isCurrentMonth: boolean }[] = [];
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = first.getDay() - 1; i >= 0; i--) result.push({ date: new Date(year, month - 1, prevMonthLastDay - i), isCurrentMonth: false });
    const d = new Date(first);
    while (d.getMonth() === month) {
      result.push({ date: new Date(d), isCurrentMonth: true });
      d.setDate(d.getDate() + 1);
    }
    const remaining = 42 - result.length;
    for (let i = 1; i <= remaining; i++) result.push({ date: new Date(year, month + 1, i), isCurrentMonth: false });
    return result;
  }, [currentDate]);

  const byDay = useMemo(() => {
    const map = new Map<string, GroupExpense[]>();
    expenses.forEach((e) => {
      const k = dayKey(effectiveDueDate(e));
      const list = map.get(k);
      if (list) list.push(e);
      else map.set(k, [e]);
    });
    return map;
  }, [expenses]);

  const monthLabel = capitalize(formatDate(currentDate, { month: 'long', year: 'numeric' }));
  const groupName = (id: string) => groups.find((g) => g.id === id)?.name ?? '';
  const selectedExpenses = byDay.get(dayKey(selectedDay)) ?? [];

  const moveMonth = (delta: number) => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + delta, 1));

  const dayStatus = (date: Date, list: GroupExpense[]) => {
    if (list.length === 0) return null;
    const pending = list.some((e) => e.status === 'pending');
    const overdue = pending && date < today && !sameDay(date, today);
    return overdue ? 'overdue' : pending ? 'pending' : 'paid';
  };

  const STATUS_DOT = { overdue: 'bg-red-600', pending: 'bg-amber-500', paid: 'bg-emerald-600' } as const;
  const STATUS_LABEL = { overdue: t('calendar.overdueItems'), pending: t('calendar.pendingItems'), paid: t('calendar.allPaid') } as const;

  return (
    <div>
      <header className="mb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="eyebrow mb-1">{t('calendar.title')}</p>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-fg font-display" aria-live="polite">
            {monthLabel}
          </h1>
        </div>
        <div className="flex items-center gap-1">
          <IconButton variant="secondary" label={t('calendar.prevMonth')} icon={<ChevronLeft className="size-5" />} onClick={() => moveMonth(-1)} />
          <Button
            variant="secondary"
            onClick={() => {
              const now = new Date();
              setCurrentDate(now);
              setSelectedDay(now);
            }}
          >
            {t('calendar.today')}
          </Button>
          <IconButton variant="secondary" label={t('calendar.nextMonth')} icon={<ChevronRight className="size-5" />} onClick={() => moveMonth(1)} />
        </div>
      </header>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_20rem] gap-6">
        <Card padding="none" className="overflow-hidden">
          {loading ? (
            <LoadingRegion label={t('common.loading')} className="p-4">
              <Skeleton className="h-[420px] w-full" />
            </LoadingRegion>
          ) : (
            <div role="grid" aria-label={monthLabel}>
              <div role="row" className="grid grid-cols-7 border-b border-line bg-surface-2/60">
                {weekdays.map((d) => (
                  <div key={d.long} role="columnheader" aria-label={d.long} className="py-2.5 text-center text-xs font-semibold text-fg-subtle">
                    <span className="sm:hidden" aria-hidden="true">{d.narrow}</span>
                    <span className="hidden sm:inline" aria-hidden="true">{d.short}</span>
                  </div>
                ))}
              </div>
              {Array.from({ length: 6 }, (_, week) => (
                <div role="row" key={week} className="grid grid-cols-7">
                  {days.slice(week * 7, week * 7 + 7).map((day) => {
                    const list = byDay.get(dayKey(day.date)) ?? [];
                    const status = dayStatus(day.date, list);
                    const isToday = sameDay(day.date, today);
                    const isSelected = sameDay(day.date, selectedDay);
                    const fullLabel = capitalize(formatDate(day.date, { weekday: 'long', day: 'numeric', month: 'long' }));
                    return (
                      <div role="gridcell" key={day.date.toISOString()} aria-selected={isSelected} className="border-b border-r border-line last:border-r-0 min-w-0">
                        <button
                          type="button"
                          onClick={() => setSelectedDay(day.date)}
                          aria-label={`${fullLabel}${list.length ? ` — ${t('calendar.itemsCount', { count: list.length })}` : ''}${status ? `, ${STATUS_LABEL[status]}` : ''}`}
                          aria-current={isToday ? 'date' : undefined}
                          className={cn(
                            'w-full h-full min-h-14 sm:min-h-28 p-1 sm:p-2 flex flex-col items-center sm:items-stretch text-left transition-colors',
                            !day.isCurrentMonth && 'bg-surface-2/40',
                            isSelected ? 'bg-brand-50 dark:bg-brand-500/10' : 'hover:bg-surface-2',
                          )}
                        >
                          <span
                            className={cn(
                              'flex size-7 items-center justify-center rounded-lg text-sm font-medium tabular',
                              !day.isCurrentMonth ? 'text-fg-subtle/70' : 'text-fg-muted',
                              isToday && 'bg-brand-600 text-white',
                              isSelected && !isToday && 'ring-2 ring-brand-500 text-fg',
                            )}
                          >
                            {day.date.getDate()}
                          </span>
                          {/* Mobile: status dot. Desktop: up to 2 chips. */}
                          {status && <span className={cn('sm:hidden mt-1 size-1.5 rounded-full', STATUS_DOT[status])} aria-hidden="true" />}
                          <span className="hidden sm:flex flex-col gap-1 mt-1 w-full" aria-hidden="true">
                            {list.slice(0, 2).map((e) => (
                              <span
                                key={e.id}
                                className={cn(
                                  'block truncate rounded-md px-1.5 py-0.5 text-xs font-medium',
                                  e.status === 'pending'
                                    ? dayStatus(day.date, [e]) === 'overdue'
                                      ? 'bg-red-50 text-red-800 dark:bg-red-500/15 dark:text-red-200'
                                      : 'bg-amber-50 text-amber-900 dark:bg-amber-500/15 dark:text-amber-200'
                                    : 'bg-surface-2 text-fg-muted',
                                )}
                              >
                                {e.description}
                              </span>
                            ))}
                            {list.length > 2 && <span className="text-xs text-fg-subtle px-1.5">{t('calendar.more', { count: list.length - 2 })}</span>}
                          </span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card as="section" aria-labelledby="calendar-day-title" className="xl:self-start">
          <h2 id="calendar-day-title" className="text-base font-semibold font-display text-fg flex items-center gap-2">
            <CalendarDays className="size-5 text-fg-subtle" aria-hidden="true" />
            {capitalize(formatDate(selectedDay, { weekday: 'long', day: 'numeric', month: 'long' }))}
          </h2>
          {selectedExpenses.length === 0 ? (
            <EmptyState compact icon={<CircleCheck />} title={t('calendar.nothingDue')} />
          ) : (
            <ul className="mt-3 divide-y divide-line">
              {selectedExpenses.map((e) => {
                const overdue = e.status === 'pending' && dayStatus(selectedDay, [e]) === 'overdue';
                return (
                  <li key={e.id}>
                    <button type="button" onClick={() => onSelectGroup(e.groupId)} className="w-full flex items-center gap-3 py-3 text-left rounded-control hover:bg-surface-2 px-2 -mx-2 transition-colors">
                      <CategoryIcon category={e.category} size="sm" />
                      <span className="flex-1 min-w-0">
                        <span className="block font-medium text-fg truncate">{e.description}</span>
                        <span className="block text-sm text-fg-subtle truncate">{groupName(e.groupId)}</span>
                      </span>
                      <span className="text-right shrink-0">
                        <span className="block font-semibold text-fg tabular">{formatCurrency(e.amount, { currency: groupCurrency(groups.find((g) => g.id === e.groupId), preferredCurrency) })}</span>
                        {e.status === 'pending' ? (
                          <Badge tone={overdue ? 'danger' : 'warning'} icon={overdue ? <AlertTriangle /> : <Clock />}>
                            {overdue ? t('dashboard.overdue') : t('common.pending')}
                          </Badge>
                        ) : (
                          <Badge tone="success">{t('status.paid')}</Badge>
                        )}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
