import { Router } from 'express';
import { db } from '../db.js';
import { expenses, groupMembers } from '../schema.js';
import { eq, and, desc, sql, gte } from 'drizzle-orm';
import { requireAuth, AuthRequest } from '../middleware/auth.js';

const router = Router({ mergeParams: true }); // Access :id from parent route

/** Helper: verify membership */
async function verifyMember(groupId: string, userId: string) {
  const [member] = await db
    .select()
    .from(groupMembers)
    .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId)))
    .limit(1);
  return !!member;
}

/** Helper: serialise expense row */
function serializeExpense(exp: typeof expenses.$inferSelect) {
  return {
    ...exp,
    amount: Number(exp.amount),
  };
}

// GET /api/groups/:id/expenses
router.get('/', requireAuth, async (req: AuthRequest, res) => {
  try {
    const uid = req.uid!;
    const { id: groupId } = req.params;

    if (!(await verifyMember(groupId, uid))) {
      return res.status(403).json({ error: 'Not a member' });
    }

    const rows = await db
      .select()
      .from(expenses)
      .where(eq(expenses.groupId, groupId))
      .orderBy(desc(expenses.date));

    res.json(rows.map(serializeExpense));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch expenses' });
  }
});

// POST /api/groups/:id/expenses
router.post('/', requireAuth, async (req: AuthRequest, res) => {
  try {
    const uid = req.uid!;
    const { id: groupId } = req.params;
    
    if (!(await verifyMember(groupId, uid))) {
      return res.status(403).json({ error: 'Not a member' });
    }

    const payload = Array.isArray(req.body) ? req.body : [req.body];
    
    const values: (typeof expenses.$inferInsert)[] = payload.map(exp => ({
      groupId,
      amount: String(exp.amount),
      description: exp.description,
      category: exp.category || 'Other',
      paidBy: exp.paidBy || uid,
      date: new Date(exp.date),
      dueDate: exp.dueDate ? new Date(exp.dueDate) : null,
      status: exp.status || 'paid',
      splitType: exp.splitType || 'equal',
      splitDetails: exp.splitDetails || {},
      isRecurring: exp.isRecurring || false,
      recurrenceId: exp.recurrenceId || null,
    }));

    const inserted = await db.insert(expenses).values(values as any).returning();
    
    if (Array.isArray(req.body)) {
      res.status(201).json(inserted.map(serializeExpense));
    } else {
      res.status(201).json(serializeExpense(inserted[0]));
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create expense' });
  }
});

// PATCH /api/groups/:id/expenses/bulk (Update series)
router.patch('/bulk', requireAuth, async (req: AuthRequest, res) => {
  try {
    const uid = req.uid!;
    const { id: groupId } = req.params;
    const { recurrenceId, fromDate, updates } = req.body;
    
    if (!(await verifyMember(groupId, uid))) {
      return res.status(403).json({ error: 'Not a member' });
    }
    
    const updateData: any = {
        amount: updates.amount !== undefined ? String(updates.amount) : undefined,
        description: updates.description,
        category: updates.category,
        status: updates.status,
        splitType: updates.splitType,
        splitDetails: updates.splitDetails,
      };

    let query = db.update(expenses)
      .set(updateData as any)
      .where(and(
        eq(expenses.groupId, groupId),
        eq(expenses.recurrenceId, recurrenceId)
      ));
      
    if (fromDate) {
      const updateData: any = {
        amount: updates.amount !== undefined ? String(updates.amount) : undefined,
        description: updates.description,
        category: updates.category,
        status: updates.status,
        splitType: updates.splitType,
        splitDetails: updates.splitDetails,
      };

      query = db.update(expenses)
      .set(updateData as any)
      .where(and(
        eq(expenses.groupId, groupId),
        eq(expenses.recurrenceId, recurrenceId),
        gte(expenses.date, new Date(fromDate))
      ));
    }

    await query;
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update expense series' });
  }
});

// DELETE /api/groups/:id/expenses/bulk (Delete series)
router.delete('/bulk', requireAuth, async (req: AuthRequest, res) => {
  try {
    const uid = req.uid!;
    const { id: groupId } = req.params;
    const { recurrenceId, fromDate } = req.body; // Sent in body since DELETE
    
    if (!(await verifyMember(groupId, uid))) {
      return res.status(403).json({ error: 'Not a member' });
    }
    
    if (fromDate) {
      await db.delete(expenses).where(and(
        eq(expenses.groupId, groupId),
        eq(expenses.recurrenceId, recurrenceId),
        gte(expenses.date, new Date(fromDate))
      ));
    } else {
      await db.delete(expenses).where(and(
        eq(expenses.groupId, groupId),
        eq(expenses.recurrenceId, recurrenceId)
      ));
    }

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete expense series' });
  }
});

// PATCH /api/groups/:id/expenses/:expId
router.patch('/:expId', requireAuth, async (req: AuthRequest, res) => {
  try {
    const uid = req.uid!;
    const { id: groupId, expId } = req.params;
    const updates = req.body;
    
    if (!(await verifyMember(groupId, uid))) {
      return res.status(403).json({ error: 'Not a member' });
    }

    const setValues: any = {};
    if (updates.amount !== undefined) setValues.amount = String(updates.amount);
    if (updates.description !== undefined) setValues.description = updates.description;
    if (updates.category !== undefined) setValues.category = updates.category;
    if (updates.date !== undefined) setValues.date = new Date(updates.date);
    if (updates.dueDate !== undefined) setValues.dueDate = updates.dueDate ? new Date(updates.dueDate) : null;
    if (updates.status !== undefined) setValues.status = updates.status;
    if (updates.splitType !== undefined) setValues.splitType = updates.splitType;
    if (updates.splitDetails !== undefined) setValues.splitDetails = (updates.splitDetails as any);

    const [updated] = await db.update(expenses)
      .set(setValues as any)
      .where(and(eq(expenses.id, expId), eq(expenses.groupId, groupId)))
      .returning();

    res.json(serializeExpense(updated));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update expense' });
  }
});

// DELETE /api/groups/:id/expenses/:expId
router.delete('/:expId', requireAuth, async (req: AuthRequest, res) => {
  try {
    const uid = req.uid!;
    const { id: groupId, expId } = req.params;
    
    if (!(await verifyMember(groupId, uid))) {
      return res.status(403).json({ error: 'Not a member' });
    }

    await db.delete(expenses).where(and(eq(expenses.id, expId), eq(expenses.groupId, groupId)));
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete expense' });
  }
});

export default router;
