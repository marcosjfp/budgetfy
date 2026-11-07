import { Router } from 'express';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { db, DbInsert, DbUpdate } from '../db.js';
import { expenses, groups, groupMembers, settlements, users } from '../schema.js';
import { asyncHandler, HttpError } from '../errors.js';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import { getMembership, requireAdmin, requireGroupForMember, requireMembership } from '../middleware/groupAccess.js';
import { lookupLimiter } from '../middleware/rateLimit.js';
import {
  addMemberSchema,
  createGroupSchema,
  currencySchema,
  groupParamsSchema,
  memberParamsSchema,
  updateGroupSchema,
  updateMemberRoleSchema,
} from '../validation.js';

const router = Router();

/** Helper: get member_ids array for a group */
async function getMemberIds(groupId: string): Promise<string[]> {
  const rows = await db
    .select({ userId: groupMembers.userId })
    .from(groupMembers)
    .where(eq(groupMembers.groupId, groupId));
  return rows.map((r) => r.userId);
}

/** Helper: serialise a group row + memberIds for the frontend */
async function serializeGroup(group: typeof groups.$inferSelect) {
  const memberIds = await getMemberIds(group.id);
  return {
    ...group,
    maxBudget: group.maxBudget ? Number(group.maxBudget) : undefined,
    memberIds,
  };
}

function requireOwner(group: typeof groups.$inferSelect, uid: string) {
  if (group.createdBy !== uid) throw new HttpError(403, 'OWNER_REQUIRED', 'Only the group owner can do this');
}

// GET /api/groups — all groups where current user is a member
router.get(
  '/',
  requireAuth,
  asyncHandler<AuthRequest>(async (req, res) => {
    const uid = req.uid!;
    const memberRows = await db
      .select({ groupId: groupMembers.groupId })
      .from(groupMembers)
      .where(eq(groupMembers.userId, uid));

    if (memberRows.length === 0) return res.json([]);

    const groupIds = memberRows.map((r) => r.groupId);
    const groupRows = await db.select().from(groups).where(inArray(groups.id, groupIds));

    res.json(await Promise.all(groupRows.map(serializeGroup)));
  }),
);

// POST /api/groups — create a new group
router.post(
  '/',
  requireAuth,
  asyncHandler<AuthRequest>(async (req, res) => {
    const uid = req.uid!;
    const { name, description, type, themeColor, maxBudget, budgetType, currency } = createGroupSchema.parse(req.body);

    const group = await db.transaction(async (tx) => {
      const [userRow] = await tx
        .select({ displayName: users.displayName, email: users.email, preferences: users.preferences })
        .from(users)
        .where(eq(users.uid, uid))
        .limit(1);
      // Currency: explicit choice, else the creator's synced preference, else NULL (= viewer's preference).
      const preferred = currencySchema.safeParse((userRow?.preferences as { currency?: unknown } | null)?.currency);
      const groupCurrency = currency ?? (preferred.success ? preferred.data : null);

      const [created] = await tx
        .insert(groups)
        .values({
          name,
          description: description || '',
          type: type || 'other',
          themeColor: themeColor || null,
          maxBudget: maxBudget ? String(maxBudget) : null,
          budgetType: maxBudget ? budgetType || 'total' : 'total',
          currency: groupCurrency,
          createdBy: uid,
        } as DbInsert<typeof groups>)
        .returning();

      // Add creator as admin member
      await tx.insert(groupMembers).values({
        groupId: created.id,
        userId: uid,
        role: 'admin',
        displayName: userRow?.displayName || null,
        email: userRow?.email || null,
      } as DbInsert<typeof groupMembers>);
      return created;
    });

    res.status(201).json(await serializeGroup(group));
  }),
);

// GET /api/groups/:id
router.get(
  '/:id',
  requireAuth,
  asyncHandler<AuthRequest>(async (req, res) => {
    const { id } = groupParamsSchema.parse(req.params);
    const { group } = await requireGroupForMember(id, req.uid!);
    res.json(await serializeGroup(group));
  }),
);

// PATCH /api/groups/:id — update settings (admins; the owner is always an admin)
router.patch(
  '/:id',
  requireAuth,
  asyncHandler<AuthRequest>(async (req, res) => {
    const uid = req.uid!;
    const { id } = groupParamsSchema.parse(req.params);
    const { name, description, themeColor, maxBudget, budgetType, currency } = updateGroupSchema.parse(req.body);

    const { group, member } = await requireGroupForMember(id, uid);
    if (member.role !== 'admin') throw new HttpError(403, 'ADMIN_REQUIRED', 'Only group admins can change settings');

    const [updated] = await db
      .update(groups)
      .set({
        name: name || group.name,
        description: description ?? group.description,
        themeColor: themeColor ?? group.themeColor,
        // Preserves existing semantics: omitting maxBudget clears it.
        maxBudget: maxBudget != null ? String(maxBudget) : null,
        budgetType: maxBudget != null ? budgetType || 'total' : 'total',
        currency: currency ?? group.currency,
      } as DbUpdate<typeof groups>)
      .where(eq(groups.id, id))
      .returning();

    res.json(await serializeGroup(updated));
  }),
);

// DELETE /api/groups/:id (owner only) — also removes members, expenses and settlements
router.delete(
  '/:id',
  requireAuth,
  asyncHandler<AuthRequest>(async (req, res) => {
    const uid = req.uid!;
    const { id } = groupParamsSchema.parse(req.params);

    const { group } = await requireGroupForMember(id, uid);
    requireOwner(group, uid);

    await db.transaction(async (tx) => {
      await tx.delete(expenses).where(eq(expenses.groupId, id));
      await tx.delete(settlements).where(eq(settlements.groupId, id));
      await tx.delete(groupMembers).where(eq(groupMembers.groupId, id));
      await tx.delete(groups).where(eq(groups.id, id));
    });
    res.json({ ok: true });
  }),
);

// GET /api/groups/:id/members
router.get(
  '/:id/members',
  requireAuth,
  asyncHandler<AuthRequest>(async (req, res) => {
    const { id } = groupParamsSchema.parse(req.params);
    await requireMembership(id, req.uid!);

    const members = await db.select().from(groupMembers).where(eq(groupMembers.groupId, id));
    res.json(
      members.map((m) => ({ uid: m.userId, role: m.role, joinedAt: m.joinedAt, displayName: m.displayName, email: m.email })),
    );
  }),
);

// POST /api/groups/:id/members — add member by email (admins only)
router.post(
  '/:id/members',
  requireAuth,
  lookupLimiter,
  asyncHandler<AuthRequest>(async (req, res) => {
    const { id } = groupParamsSchema.parse(req.params);
    const { email } = addMemberSchema.parse(req.body);
    await requireAdmin(id, req.uid!);

    const [targetUser] = await db
      .select({ uid: users.uid, displayName: users.displayName, email: users.email })
      .from(users)
      .where(sql`lower(${users.email}) = ${email}`)
      .limit(1);
    if (!targetUser) {
      throw new HttpError(404, 'USER_NOT_FOUND', 'No user found with that email. They must sign in first.');
    }

    if (await getMembership(id, targetUser.uid)) {
      throw new HttpError(409, 'ALREADY_MEMBER', 'User is already a member');
    }

    let created: typeof groupMembers.$inferSelect;
    try {
      [created] = await db
        .insert(groupMembers)
        .values({
          groupId: id,
          userId: targetUser.uid,
          role: 'member',
          displayName: targetUser.displayName,
          email: targetUser.email,
        } as DbInsert<typeof groupMembers>)
        .returning();
    } catch (err) {
      // A concurrent invite added them first (unique group_id + user_id).
      if ((err as { code?: string }).code === '23505') throw new HttpError(409, 'ALREADY_MEMBER', 'User is already a member');
      throw err;
    }

    // `ok` kept for older clients; `member` has the same shape as GET /:id/members items.
    res.status(201).json({
      ok: true,
      member: { uid: created.userId, role: created.role, joinedAt: created.joinedAt, displayName: created.displayName, email: created.email },
    });
  }),
);

// PATCH /api/groups/:id/members/:uid — change member role (admins only; owner's role is fixed)
router.patch(
  '/:id/members/:uid',
  requireAuth,
  asyncHandler<AuthRequest>(async (req, res) => {
    const { id, uid } = memberParamsSchema.parse(req.params);
    const { role } = updateMemberRoleSchema.parse(req.body);

    const { group, member: requester } = await requireGroupForMember(id, req.uid!);
    if (requester.role !== 'admin') throw new HttpError(403, 'ADMIN_REQUIRED', 'Only admins can change roles');
    if (uid === group.createdBy) {
      throw new HttpError(403, 'OWNER_PROTECTED', "The group owner's role cannot be changed");
    }
    if (!(await getMembership(id, uid))) throw new HttpError(404, 'MEMBER_NOT_FOUND', 'Member not found');

    await db
      .update(groupMembers)
      .set({ role } as DbUpdate<typeof groupMembers>)
      .where(and(eq(groupMembers.groupId, id), eq(groupMembers.userId, uid)));

    res.json({ ok: true });
  }),
);

// DELETE /api/groups/:id/members/:uid — remove member (admins), or leave the group (self)
router.delete(
  '/:id/members/:uid',
  requireAuth,
  asyncHandler<AuthRequest>(async (req, res) => {
    const requesterUid = req.uid!;
    const { id, uid } = memberParamsSchema.parse(req.params);

    const { group, member: requester } = await requireGroupForMember(id, requesterUid);
    if (requester.role !== 'admin' && requesterUid !== uid) {
      throw new HttpError(403, 'ADMIN_REQUIRED', 'Only admins can remove other members');
    }
    if (uid === group.createdBy) {
      throw new HttpError(403, 'OWNER_PROTECTED', 'The group owner cannot be removed; delete the group instead');
    }
    if (!(await getMembership(id, uid))) throw new HttpError(404, 'MEMBER_NOT_FOUND', 'Member not found');

    await db.delete(groupMembers).where(and(eq(groupMembers.groupId, id), eq(groupMembers.userId, uid)));
    res.json({ ok: true });
  }),
);

export default router;
