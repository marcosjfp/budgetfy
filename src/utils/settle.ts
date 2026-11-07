/**
 * Settle-up math: who owes whom inside a group.
 *
 * All arithmetic is done in integer cents so balances always sum to exactly zero.
 *
 * Rules (documented in README "Settle up"):
 * - Only expenses with status "paid" create debts; "pending" bills haven't been paid by anyone yet.
 * - equal split: the amount is shared by the expense's frozen `participants` (falling back to the
 *   group's current members for old expenses without them);
 *   leftover cents go to the first members in a stable (uid-sorted) order.
 * - percentage / exact split: each participant owes their share from `splitDetails`;
 *   the payer is credited with what the others owe (the payer's own share cancels out).
 * - A settlement "A paid B x" moves A's balance up by x and B's down by x.
 */

export interface ExpenseLike {
  amount: number;
  paidBy: string;
  status?: 'paid' | 'pending' | string | null;
  splitType?: 'equal' | 'percentage' | 'exact' | string | null;
  splitDetails?: Record<string, number> | null;
  participants?: string[] | null;
}

export interface SettlementLike {
  fromUser: string;
  toUser: string;
  amount: number;
}

export interface Transfer {
  from: string;
  to: string;
  /** In currency units (not cents). */
  amount: number;
}

export const toCents = (n: number) => Math.round((Number(n) || 0) * 100);
export const fromCents = (c: number) => c / 100;

/** Each participant's share of an expense, in cents. */
export function expenseShares(expense: ExpenseLike, memberIds: string[]): Map<string, number> {
  const total = toCents(expense.amount);
  const shares = new Map<string, number>();
  const type = expense.splitType || 'equal';

  if (type === 'percentage' || type === 'exact') {
    for (const [uid, value] of Object.entries(expense.splitDetails ?? {})) {
      const cents = type === 'percentage' ? Math.round((total * (Number(value) || 0)) / 100) : toCents(value);
      if (cents > 0) shares.set(uid, cents);
    }
    return shares;
  }

  const participants = [...new Set(expense.participants?.length ? expense.participants : memberIds)].sort();
  if (participants.length === 0) {
    shares.set(expense.paidBy, total);
    return shares;
  }
  const base = Math.floor(total / participants.length);
  let remainder = total - base * participants.length;
  for (const uid of participants) {
    shares.set(uid, base + (remainder > 0 ? 1 : 0));
    if (remainder > 0) remainder--;
  }
  return shares;
}

/** Net balance per user in cents: positive = is owed money, negative = owes money. */
export function computeNetBalances(expenses: ExpenseLike[], settlements: SettlementLike[], memberIds: string[]): Map<string, number> {
  const net = new Map<string, number>();
  const add = (uid: string, cents: number) => net.set(uid, (net.get(uid) ?? 0) + cents);
  memberIds.forEach((uid) => net.set(uid, 0));

  for (const e of expenses) {
    if (e.status === 'pending') continue;
    for (const [uid, share] of expenseShares(e, memberIds)) {
      if (uid === e.paidBy) continue;
      add(uid, -share);
      add(e.paidBy, share);
    }
  }
  for (const s of settlements) {
    const cents = toCents(s.amount);
    add(s.fromUser, cents);
    add(s.toUser, -cents);
  }
  return net;
}

/**
 * Minimal-ish set of transfers that settles every balance (greedy: largest debtor pays largest
 * creditor). Produces at most n-1 transfers; ties are broken by uid so output is stable.
 */
export function simplifyDebts(net: Map<string, number>): Transfer[] {
  const creditors: [string, number][] = [];
  const debtors: [string, number][] = [];
  for (const [uid, cents] of net) {
    if (cents > 0) creditors.push([uid, cents]);
    else if (cents < 0) debtors.push([uid, -cents]);
  }
  const byAmount = (a: [string, number], b: [string, number]) => b[1] - a[1] || a[0].localeCompare(b[0]);

  const transfers: Transfer[] = [];
  while (creditors.length && debtors.length) {
    creditors.sort(byAmount);
    debtors.sort(byAmount);
    const c = creditors[0];
    const d = debtors[0];
    const amount = Math.min(c[1], d[1]);
    transfers.push({ from: d[0], to: c[0], amount: fromCents(amount) });
    c[1] -= amount;
    d[1] -= amount;
    if (c[1] === 0) creditors.shift();
    if (d[1] === 0) debtors.shift();
  }
  return transfers;
}

/** Convenience: transfers needed to settle a group. */
export function settleUp(expenses: ExpenseLike[], settlements: SettlementLike[], memberIds: string[]): { net: Map<string, number>; transfers: Transfer[] } {
  const net = computeNetBalances(expenses, settlements, memberIds);
  return { net, transfers: simplifyDebts(net) };
}
