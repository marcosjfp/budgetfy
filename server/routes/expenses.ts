import { Router, Response, NextFunction } from 'express';
import { and, desc, eq, gte, inArray } from 'drizzle-orm';
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
} from '../validation.js';

const router = Router({ mergeParams: true }); // Access :id from parent route

/** Every route below requires an authenticated group member. */
router.use(
  requireAuth,
  asyncHandler<AuthRequest>(async (req, _res: Response, next: NextFunction) => {
    const { id } = groupParamsSchema.parse(req.params);
    await requireMembership(id, req.uid!);
    next();
  }),
);

function groupIdOf(req: AuthRequest): string {
  return (req.params as Record<string, string>).id;
}

/** Helper: serialise expense row */
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

// PATCH /api/groups/:id/expenses/bulk (Update series)
router.patch(
  '/bulk',
  asyncHandler<AuthRequest>(async (req, res) => {
    const groupId = groupIdOf(req);
    const { recurrenceId, fromDate, updates } = bulkUpdateSchema.parse(req.body);

    const set: Record<string, unknown> = {};
    if (updates.amount !== undefined) set.amount = String(updates.amount);
    if (updates.description !== undefined) set.description = updates.description;
    if (updates.category !== undefined) set.category = updates.category;
    if (updates.status !== undefined) set.status = updates.status;
    if (updates.splitType !== undefined) set.splitType = updates.splitType;
    if (updates.splitDetails !== undefined) set.splitDetails = updates.splitDetails ?? {};

    const conditions = [eq(expenses.groupId, groupId), eq(expenses.recurrenceId, recurrenceId)];
    if (fromDate) conditions.push(gte(expenses.date, fromDate));

    await db.update(expenses).set(set as DbUpdate<typeof expenses>).where(and(...conditions));
    res.json({ ok: true });
  }),
);

// DELETE /api/groups/:id/expenses/bulk (Delete series)
router.delete(
  '/bulk',
  asyncHandler<AuthRequest>(async (req, res) => {
    const groupId = groupIdOf(req);
    const { recurrenceId, fromDate } = bulkDeleteSchema.parse(req.body ?? {}); // Sent in body since DELETE

    const conditions = [eq(expenses.groupId, groupId), eq(expenses.recurrenceId, recurrenceId)];
    if (fromDate) conditions.push(gte(expenses.date, fromDate));

    await db.delete(expenses).where(and(...conditions));
    res.json({ ok: true });
  }),
);

// PATCH /api/groups/:id/expenses/:expId
router.patch(
  '/:expId',
  asyncHandler<AuthRequest>(async (req, res) => {
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

    const where = and(eq(expenses.id, expId), eq(expenses.groupId, groupId));
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
  asyncHandler<AuthRequest>(async (req, res) => {
    const { id: groupId, expId } = expenseParamsSchema.parse(req.params);

    const deleted = await db
      .delete(expenses)
      .where(and(eq(expenses.id, expId), eq(expenses.groupId, groupId)))
      .returning({ id: expenses.id });
    if (deleted.length === 0) throw new HttpError(404, 'EXPENSE_NOT_FOUND', 'Expense not found');
    res.json({ ok: true });
  }),
);

export default router;
