import { AppTimestamp } from '../timestamp';
import type { BudgetType, Expense, Group, Settlement } from '../types';
import type { Currency } from '../i18n/core';

export type GroupExpense = Expense & { groupId: string };

/** True if `date` falls in the current budget period (week starts Sunday). */
export function isDateInCurrentPeriod(date: Date, type: BudgetType, now = new Date()): boolean {
  if (type === 'total') return true;
  if (type === 'monthly') {
    return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
  }
  if (type === 'weekly') {
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 7);
    return date >= startOfWeek && date < endOfWeek;
  }
  return true;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
/** Convert an expense from the API (ISO strings) into the app shape (AppTimestamp). */
export function normalizeExpense<T extends Record<string, any>>(e: T): Expense & T {
  return {
    ...e,
    date: new AppTimestamp(new Date(e.date)),
    dueDate: e.dueDate ? new AppTimestamp(new Date(e.dueDate)) : undefined,
    createdAt: new AppTimestamp(new Date(e.createdAt ?? e.date)),
  } as Expense & T;
}

export function normalizeGroup(g: any): Group {
  return { ...g, createdAt: new AppTimestamp(new Date(g.createdAt)) };
}

export function normalizeSettlement(s: any): Settlement {
  return {
    ...s,
    amount: Number(s.amount),
    date: new AppTimestamp(new Date(s.date)),
    createdAt: new AppTimestamp(new Date(s.createdAt ?? s.date)),
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/** Mirrors the server rule: whoever added or paid an expense, or a group admin, may change it. */
export function canModifyExpense(e: Pick<Expense, 'paidBy' | 'createdBy'>, uid: string, isAdmin: boolean): boolean {
  return isAdmin || e.paidBy === uid || e.createdBy === uid;
}

/** Due date if set, otherwise the expense date. */
export function effectiveDueDate(e: Expense): Date {
  return e.dueDate?.toDate() ?? e.date.toDate();
}

export function isOverdue(e: Expense, now = new Date()): boolean {
  return e.status === 'pending' && effectiveDueDate(e) < now;
}

/** yyyy-mm-dd in local time (for <input type="date">). */
export function toDateInputValue(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Parse a yyyy-mm-dd input as local noon. Avoids the off-by-one-day bug of
 * `new Date('yyyy-mm-dd')` (UTC midnight) in timezones west of UTC, e.g. Brazil.
 */
export function fromDateInputValue(value: string): Date {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1, 12, 0, 0, 0);
}

/** The currency a group's amounts are shown in: its own, else the viewer's preference. */
export function groupCurrency(group: Pick<Group, 'currency'> | null | undefined, fallback: Currency): Currency {
  return (group?.currency as Currency | null | undefined) || fallback;
}
