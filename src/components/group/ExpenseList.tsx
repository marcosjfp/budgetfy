import { useId, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, Check, Clock, Download, Pencil, Plus, Receipt, Repeat, Search, SearchX, Settings2, SlidersHorizontal, Trash2, AlertCircle, X } from 'lucide-react';
import { CATEGORIES, type Expense, type GroupMember } from '../../types';
import { useI18n, CATEGORY_KEYS, SORT_KEYS, SPLIT_KEYS, STATUS_KEYS } from '../../i18n';
import { canModifyExpense, fromDateInputValue, isOverdue, toDateInputValue } from '../../utils/budget';
import { downloadTextFile, slugify, toCsv } from '../../utils/csv';
import { CategoryIcon } from '../CategoryIcon';
import { Badge, Button, Card, EmptyState, IconButton, Popover, SegmentedControl, SelectField, TextField, cn, toast } from '../ui';
import { seriesOverview, type SeriesExpense } from './groupMath';

type SortField = 'date' | 'amount' | 'category';
type StatusFilter = 'all' | 'paid' | 'pending' | 'overdue';

interface Filters {
  query: string;
  category: string;
  member: string;
  status: StatusFilter;
  from: string;
  to: string;
}

const NO_FILTERS: Filters = { query: '', category: '', member: '', status: 'all', from: '', to: '' };

/** Case- and accent-insensitive text for searching ("Pão" matches "pao"). */
const fold = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

interface ExpenseListProps {
  groupName: string;
  expenses: Expense[];
  members: GroupMember[];
  currentUserId: string;
  isAdmin: boolean;
  onView: (e: Expense) => void;
  onEdit: (e: Expense) => void;
  onDelete: (e: Expense) => void;
  onManageSeries: (recurrenceId: string) => void;
  onAdd: () => void;
}

export function ExpenseList({ groupName, expenses, members, currentUserId, isAdmin, onView, onEdit, onDelete, onManageSeries, onAdd }: ExpenseListProps) {
  const { t, label, lang, locale, currency, formatCurrency, formatDate } = useI18n();
  const [viewTab, setViewTab] = useState<'all' | 'recurring'>('all');
  const [filterSeries, setFilterSeries] = useState<string | null>(null);
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filtersId = useId();

  const memberName = (uid: string) => members.find((m) => m.uid === uid)?.displayName || t('common.unknown');
  const setFilter = <K extends keyof Filters>(key: K, value: Filters[K]) => setFilters((f) => ({ ...f, [key]: value }));
  const activeFilterCount = (['category', 'member', 'from', 'to'] as const).filter((k) => filters[k]).length + (filters.status !== 'all' ? 1 : 0);
  const hasFilters = activeFilterCount > 0 || filters.query.trim() !== '';

  /** Search + filters (applied before the "recurring" overview / series filter). */
  const matching = useMemo(() => {
    const q = fold(filters.query.trim());
    const from = filters.from ? fromDateInputValue(filters.from) : null;
    if (from) from.setHours(0, 0, 0, 0);
    const to = filters.to ? fromDateInputValue(filters.to) : null;
    if (to) to.setHours(23, 59, 59, 999);
    const now = new Date();
    return expenses.filter((e) => {
      if (filters.category && e.category !== filters.category) return false;
      if (filters.member && e.paidBy !== filters.member) return false;
      if (filters.status === 'paid' && e.status === 'pending') return false;
      if (filters.status === 'pending' && e.status !== 'pending') return false;
      if (filters.status === 'overdue' && !isOverdue(e, now)) return false;
      const d = e.date.toDate();
      if (from && d < from) return false;
      if (to && d > to) return false;
      if (q) {
        const payer = members.find((m) => m.uid === e.paidBy)?.displayName ?? '';
        const haystack = fold(`${e.description} ${label(CATEGORY_KEYS, e.category)} ${e.category} ${payer}`);
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [expenses, filters, members, label]);

  const filtered: SeriesExpense[] = useMemo(() => {
    if (filterSeries) return matching.filter((e) => e.recurrenceId === filterSeries);
    if (viewTab === 'recurring') return seriesOverview(matching);
    return matching;
  }, [matching, viewTab, filterSeries]);

  const sorted = useMemo(
    () =>
      [...filtered].sort((a, b) => {
        let c = 0;
        if (sortField === 'date') c = a.date.toMillis() - b.date.toMillis();
        else if (sortField === 'amount') c = a.amount - b.amount;
        else c = label(CATEGORY_KEYS, a.category).localeCompare(label(CATEGORY_KEYS, b.category), locale);
        return sortOrder === 'desc' ? -c : c;
      }),
    [filtered, sortField, sortOrder, label, locale],
  );

  const exportCsv = () => {
    const rows = [...matching].sort((a, b) => b.date.toMillis() - a.date.toMillis());
    if (rows.length === 0) {
      toast.info(t('csv.nothingToExport'));
      return;
    }
    const pt = lang === 'pt';
    const header = [
      t('csv.date'),
      t('csv.description'),
      t('csv.category'),
      t('csv.amount'),
      t('csv.currency'),
      t('csv.paidBy'),
      t('csv.status'),
      t('csv.dueDate'),
      t('csv.split'),
      t('csv.recurring'),
    ];
    const body = rows.map((e) => [
      toDateInputValue(e.date.toDate()),
      e.description,
      label(CATEGORY_KEYS, e.category),
      Math.round(e.amount * 100) / 100,
      currency,
      memberName(e.paidBy),
      label(STATUS_KEYS, e.status || 'paid'),
      e.dueDate ? toDateInputValue(e.dueDate.toDate()) : '',
      label(SPLIT_KEYS, e.splitType || 'equal'),
      e.isRecurring ? t('common.yes') : t('common.no'),
    ]);
    // pt-BR Excel expects ';' between fields and ',' as the decimal separator.
    const csv = toCsv([header, ...body], { delimiter: pt ? ';' : ',', decimal: pt ? ',' : '.' });
    downloadTextFile(`${slugify(groupName)}-${toDateInputValue(new Date())}.csv`, csv);
    toast.success(t('csv.exported', { count: rows.length }));
  };

  const filterDesc = filterSeries ? expenses.find((e) => e.recurrenceId === filterSeries)?.description : undefined;

  return (
    <section aria-labelledby="transactions-title" className="min-w-0">
      <h2 id="transactions-title" className="sr-only">
        {t('group.transactions')}
      </h2>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <SegmentedControl<'all' | 'recurring'>
          label={t('group.transactions')}
          value={filterSeries ? 'all' : viewTab}
          onChange={(v) => {
            setViewTab(v);
            setFilterSeries(null);
          }}
          options={[
            { value: 'all', label: t('group.allTransactions') },
            { value: 'recurring', label: t('group.recurringSeries'), icon: <Repeat /> },
          ]}
        />
        <div className="flex items-center justify-between sm:justify-end gap-3">
          <span className="text-sm text-fg-subtle tabular">{t('group.totalCount', { count: expenses.length })}</span>
          <Popover
            kind="menu"
            label={t('sort.menuLabel')}
            panelClassName="w-52 p-1.5"
            trigger={(props) => (
              <Button {...props} variant="secondary" size="sm" leftIcon={<ArrowUpDown className="size-4" aria-hidden="true" />}>
                {t('sort.label', { field: label(SORT_KEYS, sortField) })}
                <span className="sr-only">, {sortOrder === 'asc' ? t('sort.ascending') : t('sort.descending')}</span>
              </Button>
            )}
          >
            {(close) =>
              (['date', 'amount', 'category'] as const).map((field) => {
                const active = sortField === field;
                return (
                  <button
                    key={field}
                    type="button"
                    role="menuitemradio"
                    aria-checked={active}
                    onClick={() => {
                      if (active) setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                      else {
                        setSortField(field);
                        setSortOrder('desc');
                      }
                      close();
                    }}
                    className={cn(
                      'w-full flex items-center justify-between gap-2 px-3 min-h-11 rounded-control text-sm transition-colors',
                      active ? 'bg-brand-50 text-brand-800 dark:bg-brand-500/15 dark:text-brand-100 font-medium' : 'text-fg-muted hover:bg-surface-2 hover:text-fg',
                    )}
                  >
                    <span className="flex items-center gap-2">
                      {active ? <Check className="size-4" aria-hidden="true" /> : <span className="size-4" />}
                      {label(SORT_KEYS, field)}
                    </span>
                    {active &&
                      (sortOrder === 'asc' ? (
                        <ArrowUp className="size-4" aria-label={t('sort.ascending')} />
                      ) : (
                        <ArrowDown className="size-4" aria-label={t('sort.descending')} />
                      ))}
                  </button>
                );
              })
            }
          </Popover>
        </div>
      </div>

      {/* Search, filters and export */}
      <div className="mb-4 space-y-3">
        <div className="flex flex-col sm:flex-row gap-2">
          <TextField
            type="search"
            containerClassName="flex-1"
            label={t('filters.searchLabel')}
            hideLabel
            placeholder={t('filters.searchPlaceholder')}
            prefix={<Search className="size-4" aria-hidden="true" />}
            value={filters.query}
            onChange={(e) => setFilter('query', e.target.value)}
          />
          <div className="flex gap-2">
            <Button
              variant="secondary"
              className="flex-1 sm:flex-none"
              leftIcon={<SlidersHorizontal className="size-4" aria-hidden="true" />}
              aria-expanded={filtersOpen}
              aria-controls={filtersId}
              onClick={() => setFiltersOpen((v) => !v)}
            >
              {t('filters.button')}
              {activeFilterCount > 0 && (
                <Badge tone="brand" className="ml-0.5">
                  <span aria-hidden="true">{activeFilterCount}</span>
                  <span className="sr-only">{t('filters.activeCount', { count: activeFilterCount })}</span>
                </Badge>
              )}
            </Button>
            <Button variant="secondary" className="flex-1 sm:flex-none" leftIcon={<Download className="size-4" aria-hidden="true" />} onClick={exportCsv} disabled={expenses.length === 0}>
              {t('csv.export')}
            </Button>
          </div>
        </div>

        {filtersOpen && (
          <Card id={filtersId} padding="sm" role="group" aria-label={t('filters.panelLabel')}>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <SelectField label={t('common.category')} value={filters.category} onChange={(e) => setFilter('category', e.target.value)}>
                <option value="">{t('filters.allCategories')}</option>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {label(CATEGORY_KEYS, c)}
                  </option>
                ))}
              </SelectField>
              <SelectField label={t('filters.paidBy')} value={filters.member} onChange={(e) => setFilter('member', e.target.value)}>
                <option value="">{t('filters.anyone')}</option>
                {members.map((m) => (
                  <option key={m.uid} value={m.uid}>
                    {m.displayName || m.email || t('common.unknown')}
                  </option>
                ))}
              </SelectField>
              <SelectField label={t('filters.status')} value={filters.status} onChange={(e) => setFilter('status', e.target.value as StatusFilter)}>
                <option value="all">{t('filters.anyStatus')}</option>
                <option value="paid">{t('status.paid')}</option>
                <option value="pending">{t('status.pending')}</option>
                <option value="overdue">{t('filters.overdue')}</option>
              </SelectField>
              <TextField label={t('filters.from')} type="date" value={filters.from} max={filters.to || undefined} onChange={(e) => setFilter('from', e.target.value)} />
              <TextField label={t('filters.to')} type="date" value={filters.to} min={filters.from || undefined} onChange={(e) => setFilter('to', e.target.value)} />
              <div className="flex items-end">
                <Button variant="ghost" fullWidth leftIcon={<X className="size-4" aria-hidden="true" />} onClick={() => setFilters(NO_FILTERS)} disabled={!hasFilters}>
                  {t('filters.clear')}
                </Button>
              </div>
            </div>
          </Card>
        )}

        {hasFilters && (
          <p className="text-sm text-fg-subtle tabular" role="status">
            {t('filters.showing', { count: matching.length, total: expenses.length })}
          </p>
        )}
      </div>

      <Card padding="none" className="overflow-hidden">
        {filterSeries && (
          <div className="flex items-center justify-between gap-3 p-3 sm:p-4 bg-brand-50/70 dark:bg-brand-500/10 border-b border-line">
            <div className="flex items-center gap-3 min-w-0">
              <Repeat className="size-5 text-brand-700 dark:text-brand-300 shrink-0" aria-hidden="true" />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-fg truncate">{filterDesc ?? t('group.recurringSeries')}</p>
                <p className="text-xs text-fg-muted">{t('group.seriesFilterSubtitle')}</p>
              </div>
            </div>
            <Button size="sm" variant="secondary" leftIcon={<X className="size-4" aria-hidden="true" />} onClick={() => setFilterSeries(null)}>
              {t('group.clearFilter')}
            </Button>
          </div>
        )}
        {viewTab === 'recurring' && !filterSeries && expenses.length > 0 && (
          <div className="p-3 sm:p-4 border-b border-line">
            <p className="text-sm font-semibold text-fg">{t('group.recurringSubscriptions')}</p>
            <p className="text-xs text-fg-muted">{t('group.recurringSubscriptionsSubtitle')}</p>
          </div>
        )}

        {expenses.length === 0 ? (
          <EmptyState
            icon={<Receipt />}
            title={t('group.noTransactions')}
            description={t('group.noTransactionsSubtitle')}
            action={
              <Button leftIcon={<Plus className="size-4" aria-hidden="true" />} onClick={onAdd}>
                {t('group.addExpense')}
              </Button>
            }
          />
        ) : sorted.length === 0 && hasFilters ? (
          <EmptyState
            compact
            icon={<SearchX />}
            title={t('filters.noMatches')}
            description={t('filters.noMatchesHint')}
            action={
              <Button variant="secondary" size="sm" onClick={() => setFilters(NO_FILTERS)}>
                {t('filters.clear')}
              </Button>
            }
          />
        ) : sorted.length === 0 ? (
          <EmptyState compact icon={<Repeat />} title={t('group.noRecurring')} description={t('group.noRecurringHint')} />
        ) : (
          <ul className="divide-y divide-line">
            {sorted.map((expense) => {
              const canEdit = canModifyExpense(expense, currentUserId, isAdmin);
              return (
                <li key={expense.id} className="group relative flex items-center gap-3 sm:gap-4 p-3 sm:p-4 hover:bg-surface-2/60 transition-colors">
                  <CategoryIcon category={expense.category}>
                    {expense.isRecurring && (
                      <span className="absolute -top-1 -right-1 flex size-4.5 items-center justify-center rounded-full bg-brand-600 text-white ring-2 ring-surface">
                        <Repeat className="size-2.5" />
                      </span>
                    )}
                  </CategoryIcon>
                  <div className="flex-1 min-w-0">
                    {/* The whole row opens details; this button is the accessible target. */}
                    <button type="button" onClick={() => onView(expense)} className="text-left w-full after:absolute after:inset-0 focus-visible:outline-none after:rounded-none focus-visible:after:outline-2 focus-visible:after:outline-ring focus-visible:after:-outline-offset-2">
                      <span className="block font-medium text-fg truncate">{expense.description}</span>
                    </button>
                    <p className="text-sm text-fg-subtle truncate">
                      {viewTab === 'recurring' && !filterSeries ? `${t('group.nextOccurrence')}: ` : ''}
                      {formatDate(expense.date.toDate(), { month: 'short', day: 'numeric' })} · {label(CATEGORY_KEYS, expense.category)} ·{' '}
                      {t('group.paidBy', { name: memberName(expense.paidBy) })}
                    </p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5 empty:hidden">
                      {expense.dueDate && (
                        <Badge tone={expense.status === 'pending' ? 'warning' : 'neutral'} icon={<Clock />}>
                          {t('common.due', { date: formatDate(expense.dueDate.toDate(), { month: 'short', day: 'numeric' }) })}
                        </Badge>
                      )}
                      {expense.status === 'pending' && !expense.dueDate && (
                        <Badge tone="warning" icon={<AlertCircle />}>
                          {t('group.pendingPayment')}
                        </Badge>
                      )}
                      {viewTab === 'recurring' && !filterSeries && (expense.occurrenceCount ?? 0) > 0 && (
                        <Badge tone="brand">{t('group.instances', { count: expense.occurrenceCount ?? 0 })}</Badge>
                      )}
                      {expense.isRecurring && !filterSeries && expense.recurrenceId && (
                        <span className="relative z-10 flex items-center gap-1">
                          <Button size="sm" variant="ghost" className="h-8 px-2 text-xs" leftIcon={<Settings2 className="size-3.5" aria-hidden="true" />} onClick={() => onManageSeries(expense.recurrenceId!)}>
                            {t('group.manage')}
                          </Button>
                          <Button size="sm" variant="ghost" className="h-8 px-2 text-xs" leftIcon={<Repeat className="size-3.5" aria-hidden="true" />} onClick={() => setFilterSeries(expense.recurrenceId!)}>
                            {t('group.viewAll')}
                          </Button>
                        </span>
                      )}
                    </div>
                  </div>
                  <p className="font-semibold text-fg tabular shrink-0 text-right">{formatCurrency(expense.amount)}</p>
                  {canEdit && (
                    <div className="relative z-10 flex items-center shrink-0 -mr-1 pointer-fine:opacity-0 pointer-fine:group-hover:opacity-100 pointer-fine:group-focus-within:opacity-100 transition-opacity">
                      <IconButton size="sm" label={t('group.editExpenseNamed', { name: expense.description })} icon={<Pencil className="size-4" />} onClick={() => onEdit(expense)} />
                      <IconButton size="sm" variant="danger" label={t('group.deleteExpenseNamed', { name: expense.description })} icon={<Trash2 className="size-4" />} onClick={() => onDelete(expense)} />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </section>
  );
}
