import { Router, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { and, desc, eq, gte, inArray, sql } from 'drizzle-orm';
import { db, DbInsert, DbUpdate } from '../db.js';
import { expenses, groupMembers } from '../schema.js';
import { asyncHandler, HttpError } from '../errors.js';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import { requireMembership } from '../middleware/groupAccess.js';
import {
  bulkDeleteSchema,
  bulkUpdateSchema,
  createExpensesBodySchema,
  expenseParamsSchema,
  groupParamsSchema,
  updateExpenseSchema,
  createSeriesSchema,
} from '../validation.js';

const router = Router({ mergeParams: true }); // Access :id from parent route

type MemberRequest = AuthRequest & { membershipRole?: string };

/** Every route below requires an authenticated group member. */
router.use(
  requireAuth,
  asyncHandler<MemberRequest>(async (req, _res: Response, next: NextFunction) => {
    const { id } = groupParamsSchema.parse(req.params);
    const member = await requireMembership(id, req.uid!);
    req.membershipRole = member.role;
    next();
  }),
);

/** Who may edit or delete an expense: whoever added it, whoever paid it, or a group admin. */
function canModify(req: MemberRequest, row: { paidBy: string; createdBy: string | null }) {
  return req.membershipRole === 'admin' || row.paidBy === req.uid || row.createdBy === req.uid;
}

/** Throws 404 if no rows matched, 403 if the caller may not change every one of them. */
function assertCanModify(req: MemberRequest, rows: { paidBy: string; createdBy: string | null }[]) {
  if (rows.length === 0) throw new HttpError(404, 'EXPENSE_NOT_FOUND', 'Expense not found');
  if (!rows.every((r) => canModify(req, r))) {
    throw new HttpError(403, 'EXPENSE_FORBIDDEN', 'Only the person who added or paid this expense, or a group admin, can change it');
  }
}

/** Most occurrences one recurring series may create (a year of daily expenses). */
const MAX_OCCURRENCES = 366;

/**
 * Occurrence dates from `start` to `end` (inclusive), in UTC so the server's timezone doesn't matter.
 * Monthly/yearly keep the start day, clamped to the month's last day (Jan 31 -> Feb 28 -> Mar 31).
 */
function seriesDates(start: Date, end: Date, frequency: 'daily' | 'weekly' | 'monthly' | 'yearly', limit: number): Date[] {
  const y = start.getUTCFullYear();
  const m = start.getUTCMonth();
  const d = start.getUTCDate();
  const time = start.getTime() - Date.UTC(y, m, d);
  const dates: Date[] = [];
  for (let n = 0; n < limit; n++) {
    let day: number;
    if (frequency === 'daily') day = Date.UTC(y, m, d + n);
    else if (frequency === 'weekly') day = Date.UTC(y, m, d + 7 * n);
    else {
      const year = frequency === 'yearly' ? y + n : y;
      const month = frequency === 'monthly' ? m + n : m;
      const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
      day = Date.UTC(year, month, Math.min(d, lastDay));
    }
    const at = new Date(day + time);
    if (at.getTime() > end.getTime()) break;
    dates.push(at);
  }
  return dates;
}

function groupIdOf(req: AuthRequest): string {
  return (req.params as Record<string, string>).id;
}

/** Helper: serialise expense row */
/** Current member ids of a group, sorted: the participants frozen onto new equal-split expenses. */
async function currentMemberIds(groupId: string): Promise<string[]> {
  const rows = await db.select({ userId: groupMembers.userId }).from(groupMembers).where(eq(groupMembers.groupId, groupId));
  return [...new Set(rows.map((r) => r.userId))].sort();
}

/** SQL for "keep existing participants, otherwise freeze the current members" (when switching to equal). */
function freezeParticipants(memberIds: string[]) {
  return sql`coalesce(${expenses.participants}, ${JSON.stringify(memberIds)}::jsonb)`;
}

function serializeExpense(exp: typeof expenses.$inferSelect) {
  return {
    ...exp,
    amount: Number(exp.amount),
  };
}

// GET /api/groups/:id/expenses
router.get(
  '/',
  asyncHandler<AuthRequest>(async (req, res) => {
    const rows = await db
      .select()
      .from(expenses)
      .where(eq(expenses.groupId, groupIdOf(req)))
      .orderBy(desc(expenses.date));

    res.json(rows.map(serializeExpense));
  }),
);

// POST /api/groups/:id/expenses — single expense or array (recurring series)
router.post(
  '/',
  asyncHandler<AuthRequest>(async (req, res) => {
    const uid = req.uid!;
    const groupId = groupIdOf(req);
    const body = createExpensesBodySchema.parse(req.body);
    const payload = Array.isArray(body) ? body : [body];

    // The payer must be a member of this group.
    const payers = [...new Set(payload.map((e) => e.paidBy || uid))];
    const memberRows = await db
      .select({ userId: groupMembers.userId })
      .from(groupMembers)
      .where(and(eq(groupMembers.groupId, groupId), inArray(groupMembers.userId, payers)));
    if (memberRows.length !== payers.length) {
      throw new HttpError(400, 'PAYER_NOT_MEMBER', 'The payer must be a member of this group');
    }

    const memberIds = await currentMemberIds(groupId);
    const values = payload.map((exp) => ({
      groupId, // always from the URL, never from the body
      amount: String(exp.amount),
      description: exp.description,
      category: exp.category || 'Other',
      paidBy: exp.paidBy || uid,
      date: exp.date,
      dueDate: exp.dueDate ?? null,
      status: exp.status || 'paid',
      splitType: exp.splitType || 'equal',
      splitDetails: exp.splitDetails || {},
      participants: (exp.splitType || 'equal') === 'equal' ? memberIds : null,
      createdBy: uid,
      isRecurring: exp.isRecurring || false,
      recurrenceId: exp.recurrenceId || null,
    }));

    const inserted = await db.insert(expenses).values(values as DbInsert<typeof expenses>[]).returning();

    if (Array.isArray(body)) {
      res.status(201).json(inserted.map(serializeExpense));
    } else {
      res.status(201).json(serializeExpense(inserted[0]));
    }
  }),
);

// POST /api/groups/:id/expenses/series — { expense, recurrence: { frequency, endDate } }
// Creates every occurrence in one statement (all or nothing).
router.post(
  '/series',
  asyncHandler<MemberRequest>(async (req, res) => {
    const uid = req.uid!;
    const groupId = groupIdOf(req);
    const { expense: exp, recurrence } = createSeriesSchema.parse(req.body);

    const paidBy = exp.paidBy || uid;
    const [payer] = await db
      .select({ userId: groupMembers.userId })
      .from(groupMembers)
      .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, paidBy)))
      .limit(1);
    if (!payer) throw new HttpError(400, 'PAYER_NOT_MEMBER', 'The payer must be a member of this group');

    const memberIds = await currentMemberIds(groupId);
    const recurrenceId = crypto.randomUUID();
    const dueOffset = exp.dueDate ? exp.dueDate.getTime() - exp.date.getTime() : null;
    // One extra date tells us whether the series was cut at the limit.
    const all = seriesDates(exp.date, recurrence.endDate, recurrence.frequency, MAX_OCCURRENCES + 1);
    const dates = all.slice(0, MAX_OCCURRENCES);

    const values = dates.map((date) => ({
      groupId,
      amount: String(exp.amount),
      description: exp.description,
      category: exp.category || 'Other',
      paidBy,
      date,
      dueDate: dueOffset !== null ? new Date(date.getTime() + dueOffset) : null,
      status: exp.status || 'paid',
      splitType: exp.splitType || 'equal',
      splitDetails: exp.splitDetails || {},
      participants: (exp.splitType || 'equal') === 'equal' ? memberIds : null,
      createdBy: uid,
      isRecurring: true,
      recurrenceId,
    }));
    const inserted = await db.insert(expenses).values(values as DbInsert<typeof expenses>[]).returning();
    res.status(201).json({
      recurrenceId,
      count: inserted.length,
      truncated: all.length > MAX_OCCURRENCES,
      expenses: inserted.map(serializeExpense),
    });
  }),
);

// PATCH /api/groups/:id/expenses/bulk (Update series)
router.patch(
  '/bulk',
  asyncHandler<MemberRequest>(async (req, res) => {
    const groupId = groupIdOf(req);
    const { recurrenceId, fromDate, updates } = bulkUpdateSchema.parse(req.body);

    const set: Record<string, unknown> = {};
    if (updates.amount !== undefined) set.amount = String(updates.amount);
    if (updates.description !== undefined) set.description = updates.description;
    if (updates.category !== undefined) set.category = updates.category;
    if (updates.status !== undefined) set.status = updates.status;
    if (updates.splitType !== undefined) set.splitType = updates.splitType;
    if (updates.splitDetails !== undefined) set.splitDetails = updates.splitDetails ?? {};
    if (updates.splitType === 'equal') set.participants = freezeParticipants(await currentMemberIds(groupId));

    const conditions = [eq(expenses.groupId, groupId), eq(expenses.recurrenceId, recurrenceId)];
    if (fromDate) conditions.push(gte(expenses.date, fromDate));
    assertCanModify(req, await db.select({ paidBy: expenses.paidBy, createdBy: expenses.createdBy }).from(expenses).where(and(...conditions)));

    await db.update(expenses).set(set as DbUpdate<typeof expenses>).where(and(...conditions));
    res.json({ ok: true });
  }),
);

// DELETE /api/groups/:id/expenses/bulk (Delete series)
router.delete(
  '/bulk',
  asyncHandler<MemberRequest>(async (req, res) => {
    const groupId = groupIdOf(req);
    const { recurrenceId, fromDate } = bulkDeleteSchema.parse(req.body ?? {}); // Sent in body since DELETE

    const conditions = [eq(expenses.groupId, groupId), eq(expenses.recurrenceId, recurrenceId)];
    if (fromDate) conditions.push(gte(expenses.date, fromDate));
    assertCanModify(req, await db.select({ paidBy: expenses.paidBy, createdBy: expenses.createdBy }).from(expenses).where(and(...conditions)));

    await db.delete(expenses).where(and(...conditions));
    res.json({ ok: true });
  }),
);

// PATCH /api/groups/:id/expenses/:expId
router.patch(
  '/:expId',
  asyncHandler<MemberRequest>(async (req, res) => {
    const { id: groupId, expId } = expenseParamsSchema.parse(req.params);
    const updates = updateExpenseSchema.parse(req.body);

    const set: Record<string, unknown> = {};
    if (updates.amount !== undefined) set.amount = String(updates.amount);
    if (updates.description !== undefined) set.description = updates.description;
    if (updates.category !== undefined) set.category = updates.category;
    if (updates.date !== undefined) set.date = updates.date;
    if (updates.dueDate !== undefined) set.dueDate = updates.dueDate;
    if (updates.status !== undefined) set.status = updates.status;
    if (updates.splitType !== undefined) set.splitType = updates.splitType;
    if (updates.splitDetails !== undefined) set.splitDetails = updates.splitDetails ?? {};
    if (updates.splitType === 'equal') set.participants = freezeParticipants(await currentMemberIds(groupId));

    const where = and(eq(expenses.id, expId), eq(expenses.groupId, groupId));
    assertCanModify(req, await db.select({ paidBy: expenses.paidBy, createdBy: expenses.createdBy }).from(expenses).where(where).limit(1));
    const [updated] =
      Object.keys(set).length > 0
        ? await db.update(expenses).set(set as DbUpdate<typeof expenses>).where(where).returning()
        : await db.select().from(expenses).where(where).limit(1);

    if (!updated) throw new HttpError(404, 'EXPENSE_NOT_FOUND', 'Expense not found');
    res.json(serializeExpense(updated));
  }),
);

// DELETE /api/groups/:id/expenses/:expId
router.delete(
  '/:expId',
  asyncHandler<MemberRequest>(async (req, res) => {
    const { id: groupId, expId } = expenseParamsSchema.parse(req.params);
    const where = and(eq(expenses.id, expId), eq(expenses.groupId, groupId));
    assertCanModify(req, await db.select({ paidBy: expenses.paidBy, createdBy: expenses.createdBy }).from(expenses).where(where).limit(1));

    const deleted = await db
      .delete(expenses)
      .where(and(eq(expenses.id, expId), eq(expenses.groupId, groupId)))
      .returning({ id: expenses.id });
    if (deleted.length === 0) throw new HttpError(404, 'EXPENSE_NOT_FOUND', 'Expense not found');
    res.json({ ok: true });
  }),
);

export default router;
