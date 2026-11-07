import type { Expense, Group, GroupMember } from '../../types';
import { isDateInCurrentPeriod } from '../../utils/budget';

export type SeriesExpense = Expense & { occurrenceCount?: number };
export type ScopeChoice = 'this' | 'future' | 'series';

/** Categorical palette for charts (distinguishable in light & dark, ≥ 3:1 vs both surfaces). */
export const CHART_COLORS = ['#4f46e5', '#059669', '#d97706', '#db2777', '#0891b2', '#7c3aed', '#dc2626', '#65a30d', '#71717a'];

export function computeGroupStats(group: Group, expenses: Expense[], members: GroupMember[], uid: string) {
  const currentPeriodExpenses = expenses.filter((e) => isDateInCurrentPeriod(e.date.toDate(), group.budgetType || 'total'));
  const totalSpent = currentPeriodExpenses.reduce((sum, e) => sum + e.amount, 0);
  const userSpent = currentPeriodExpenses.filter((e) => e.paidBy === uid).reduce((sum, e) => sum + e.amount, 0);
  const userShare = currentPeriodExpenses.reduce((sum, e) => {
    if (!e.splitType || e.splitType === 'equal') return sum + (members.length > 0 ? e.amount / members.length : 0);
    if (e.splitType === 'percentage') return sum + (e.amount * (e.splitDetails?.[uid] || 0)) / 100;
    if (e.splitType === 'exact') return sum + (e.splitDetails?.[uid] || 0);
    return sum;
  }, 0);
  const paidPct = totalSpent > 0 ? (userSpent / totalSpent) * 100 : 0;
  return { currentPeriodExpenses, totalSpent, userSpent, userShare, balance: userSpent - userShare, paidPct };
}

/** Upcoming pending bills due within 3 days. */
export function upcomingBills(expenses: Expense[], now = new Date()) {
  const limit = new Date(now);
  limit.setDate(now.getDate() + 3);
  return expenses
    .filter((e) => e.status === 'pending' && e.dueDate && e.dueDate.toDate() >= now && e.dueDate.toDate() <= limit)
    .sort((a, b) => a.dueDate!.toMillis() - b.dueDate!.toMillis());
}

/** One entry per recurring series (first occurrence), with occurrence count. */
export function seriesOverview(expenses: Expense[]): SeriesExpense[] {
  const seriesMap = new Map<string, SeriesExpense>();
  expenses
    .filter((e) => e.isRecurring && e.recurrenceId)
    .forEach((e) => {
      const rid = e.recurrenceId!;
      const entry = seriesMap.get(rid);
      if (!entry) seriesMap.set(rid, { ...e, occurrenceCount: 1 });
      else entry.occurrenceCount = (entry.occurrenceCount || 0) + 1;
    });
  return Array.from(seriesMap.values());
}

export function sumBy<T>(items: T[], fn: (item: T) => number) {
  return items.reduce((s, i) => s + fn(i), 0);
}

/** Split an amount (or 100%) across members; remainder goes to the current user. */
export function initialSplit(type: 'percentage' | 'exact', members: GroupMember[], uid: string, amount: number): Record<string, number> {
  const details: Record<string, number> = {};
  if (members.length === 0) return details;
  const total = type === 'percentage' ? 100 : amount;
  const each = Math.floor((total / members.length) * 100) / 100;
  members.forEach((m) => (details[m.uid] = each));
  const currentSum = each * members.length;
  details[uid] = parseFloat((each + (total - currentSum)).toFixed(2));
  return details;
}

export function evenSplit(type: 'percentage' | 'exact', members: GroupMember[], amount: number): Record<string, number> {
  const details: Record<string, number> = {};
  if (members.length === 0) return details;
  const each = (type === 'percentage' ? 100 : amount) / members.length;
  members.forEach((m) => (details[m.uid] = parseFloat(each.toFixed(2))));
  return details;
}
