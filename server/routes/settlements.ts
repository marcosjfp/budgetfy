import { Router, Response, NextFunction } from 'express';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { db, DbInsert } from '../db.js';
import { groupMembers, settlements } from '../schema.js';
import { asyncHandler, HttpError } from '../errors.js';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import { requireMembership } from '../middleware/groupAccess.js';
import { createSettlementSchema, groupParamsSchema, settlementParamsSchema } from '../validation.js';

/**
 * Settle-up payments for a group, mounted at /api/groups/:id/settlements.
 *
 * A settlement records that `fromUser` paid `toUser` `amount` (group currency) outside the app.
 * Balances are computed on the client from expenses + settlements (src/utils/settle.ts).
 */
const router = Router({ mergeParams: true });

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

function groupIdOf(req: AuthRequest): string {
  return (req.params as Record<string, string>).id;
}

function serializeSettlement(row: typeof settlements.$inferSelect) {
  return { ...row, amount: Number(row.amount) };
}

// GET /api/groups/:id/settlements
router.get(
  '/',
  asyncHandler<MemberRequest>(async (req, res) => {
    const rows = await db
      .select()
      .from(settlements)
      .where(eq(settlements.groupId, groupIdOf(req)))
      .orderBy(desc(settlements.date));
    res.json(rows.map(serializeSettlement));
  }),
);

// POST /api/groups/:id/settlements — { fromUser, toUser, amount, date?, note? }
router.post(
  '/',
  asyncHandler<MemberRequest>(async (req, res) => {
    const uid = req.uid!;
    const groupId = groupIdOf(req);
    const { fromUser, toUser, amount, date, note } = createSettlementSchema.parse(req.body);

    // Members may record payments they're part of; admins may record any payment in the group.
    if (req.membershipRole !== 'admin' && uid !== fromUser && uid !== toUser) {
      throw new HttpError(403, 'ADMIN_REQUIRED', 'Only admins can record payments between other members');
    }

    const rows = await db
      .select({ userId: groupMembers.userId })
      .from(groupMembers)
      .where(and(eq(groupMembers.groupId, groupId), inArray(groupMembers.userId, [fromUser, toUser])));
    if (rows.length !== 2) {
      throw new HttpError(400, 'INVALID_SETTLEMENT', 'Both people must be members of this group');
    }

    const [created] = await db
      .insert(settlements)
      .values({
        groupId,
        fromUser,
        toUser,
        amount: String(amount),
        date: date ?? new Date(),
        note: note || null,
        createdBy: uid,
      } as DbInsert<typeof settlements>)
      .returning();

    res.status(201).json(serializeSettlement(created));
  }),
);

// DELETE /api/groups/:id/settlements/:settlementId — the person who recorded it, or an admin
router.delete(
  '/:settlementId',
  asyncHandler<MemberRequest>(async (req, res) => {
    const { id: groupId, settlementId } = settlementParamsSchema.parse(req.params);
    const where = and(eq(settlements.id, settlementId), eq(settlements.groupId, groupId));

    const [row] = await db.select().from(settlements).where(where).limit(1);
    if (!row) throw new HttpError(404, 'SETTLEMENT_NOT_FOUND', 'Payment not found');
    if (row.createdBy !== req.uid && req.membershipRole !== 'admin') {
      throw new HttpError(403, 'ADMIN_REQUIRED', 'Only admins can delete payments recorded by others');
    }

    await db.delete(settlements).where(where);
    res.json({ ok: true });
  }),
);

export default router;
