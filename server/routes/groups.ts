import { Router } from 'express';
import { db } from '../db.js';
import { groups, groupMembers, users } from '../schema.js';
import { eq, and, inArray, sql } from 'drizzle-orm';
import { requireAuth, AuthRequest } from '../middleware/auth.js';

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

// GET /api/groups — all groups where current user is a member
router.get('/', requireAuth, async (req: AuthRequest, res) => {
  try {
    const uid = req.uid!;
    const memberRows = await db
      .select({ groupId: groupMembers.groupId })
      .from(groupMembers)
      .where(eq(groupMembers.userId, uid));

    if (memberRows.length === 0) return res.json([]);

    const groupIds = memberRows.map((r) => r.groupId);
    const groupRows = await db.select().from(groups).where(inArray(groups.id, groupIds));

    const result = await Promise.all(groupRows.map(serializeGroup));
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch groups' });
  }
});

// POST /api/groups — create a new group
router.post('/', requireAuth, async (req: AuthRequest, res) => {
  try {
    const uid = req.uid!;
    const { name, description, type, themeColor, maxBudget, budgetType } = req.body;

    const groupData: any = {
      name: name.trim(),
      description: description?.trim() || '',
      type: type || 'other',
      themeColor: themeColor || null,
      maxBudget: maxBudget ? String(maxBudget) : null,
      budgetType: maxBudget ? (budgetType || 'total') : 'total',
      createdBy: uid,
    };

    const [group] = await db.insert(groups).values(groupData as any).returning();

    // Add creator as admin member
    const [userRow] = await db.select().from(users).where(eq(users.uid, uid)).limit(1);
    const memberData: any = {
      groupId: group.id,
      userId: uid,
      role: 'admin',
      displayName: userRow?.displayName || null,
      email: userRow?.email || null,
    };
    await db.insert(groupMembers).values(memberData as any);

    res.status(201).json(await serializeGroup(group));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create group' });
  }
});

// GET /api/groups/:id
router.get('/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const uid = req.uid!;
    const { id } = req.params;

    const [group] = await db.select().from(groups).where(eq(groups.id, id)).limit(1);
    if (!group) return res.status(404).json({ error: 'Group not found' });

    // Verify membership
    const [member] = await db
      .select()
      .from(groupMembers)
      .where(and(eq(groupMembers.groupId, id), eq(groupMembers.userId, uid)))
      .limit(1);
    if (!member) return res.status(403).json({ error: 'Not a member' });

    res.json(await serializeGroup(group));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch group' });
  }
});

// PATCH /api/groups/:id — update settings
router.patch('/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const uid = req.uid!;
    const { id } = req.params;
    const { name, description, themeColor, maxBudget, budgetType } = req.body;

    const [group] = await db.select().from(groups).where(eq(groups.id, id)).limit(1);
    if (!group) return res.status(404).json({ error: 'Not found' });
    if (group.createdBy !== uid) return res.status(403).json({ error: 'Forbidden' });

    const updateData: any = {
      name: name?.trim() || group.name,
      description: description?.trim() ?? group.description,
      themeColor: themeColor ?? group.themeColor,
      maxBudget: maxBudget != null ? String(maxBudget) : null,
      budgetType: maxBudget != null ? (budgetType || 'total') : 'total',
    };

    const [updated] = await db.update(groups).set(updateData as any).where(eq(groups.id, id)).returning();

    res.json(await serializeGroup(updated));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update group' });
  }
});

// DELETE /api/groups/:id
router.delete('/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const uid = req.uid!;
    const { id } = req.params;

    const [group] = await db.select().from(groups).where(eq(groups.id, id)).limit(1);
    if (!group) return res.status(404).json({ error: 'Not found' });
    if (group.createdBy !== uid) return res.status(403).json({ error: 'Forbidden' });

    await db.delete(groups).where(eq(groups.id, id));
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete group' });
  }
});

// GET /api/groups/:id/members
router.get('/:id/members', requireAuth, async (req: AuthRequest, res) => {
  try {
    const uid = req.uid!;
    const { id } = req.params;

    const [isMember] = await db
      .select()
      .from(groupMembers)
      .where(and(eq(groupMembers.groupId, id), eq(groupMembers.userId, uid)))
      .limit(1);
    if (!isMember) return res.status(403).json({ error: 'Not a member' });

    const members = await db.select().from(groupMembers).where(eq(groupMembers.groupId, id));
    res.json(members.map((m) => ({ uid: m.userId, role: m.role, joinedAt: m.joinedAt, displayName: m.displayName, email: m.email })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch members' });
  }
});

// POST /api/groups/:id/members — add member by email
router.post('/:id/members', requireAuth, async (req: AuthRequest, res) => {
  try {
    const uid = req.uid!;
    const { id } = req.params;
    const { email } = req.body;

    // Verify requester is admin
    const [requester] = await db
      .select()
      .from(groupMembers)
      .where(and(eq(groupMembers.groupId, id), eq(groupMembers.userId, uid)))
      .limit(1);
    if (!requester || requester.role !== 'admin') {
      return res.status(403).json({ error: 'Only admins can add members' });
    }

    // Find user by email
    const [targetUser] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (!targetUser) return res.status(404).json({ error: 'No user found with that email. They must sign in first.' });

    // Check not already a member
    const [existing] = await db
      .select()
      .from(groupMembers)
      .where(and(eq(groupMembers.groupId, id), eq(groupMembers.userId, targetUser.uid)))
      .limit(1);
    if (existing) return res.status(409).json({ error: 'User is already a member' });

    const memberData: any = {
      groupId: id,
      userId: targetUser.uid,
      role: 'member',
      displayName: targetUser.displayName,
      email: targetUser.email,
    };

    await db.insert(groupMembers).values(memberData as any);

    res.status(201).json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to add member' });
  }
});

// PATCH /api/groups/:id/members/:uid — change member role
router.patch('/:id/members/:uid', requireAuth, async (req: AuthRequest, res) => {
  try {
    const requesterUid = req.uid!;
    const { id, uid } = req.params;
    const { role } = req.body;

    // Verify requester is admin
    const [requester] = await db
      .select()
      .from(groupMembers)
      .where(and(eq(groupMembers.groupId, id), eq(groupMembers.userId, requesterUid)))
      .limit(1);
    
    if (!requester || requester.role !== 'admin') {
      return res.status(403).json({ error: 'Only admins can change roles' });
    }

    await db.update(groupMembers)
      .set({ role } as any)
      .where(and(eq(groupMembers.groupId, id), eq(groupMembers.userId, uid)));

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update member role' });
  }
});

// DELETE /api/groups/:id/members/:uid — remove member
router.delete('/:id/members/:uid', requireAuth, async (req: AuthRequest, res) => {
  try {
    const requesterUid = req.uid!;
    const { id, uid } = req.params;

    // Verify requester is admin OR is the user themselves (leaving the group)
    const [requester] = await db
      .select()
      .from(groupMembers)
      .where(and(eq(groupMembers.groupId, id), eq(groupMembers.userId, requesterUid)))
      .limit(1);
    
    if (!requester || (requester.role !== 'admin' && requesterUid !== uid)) {
      return res.status(403).json({ error: 'Only admins can remove other members' });
    }

    await db.delete(groupMembers).where(and(eq(groupMembers.groupId, id), eq(groupMembers.userId, uid)));

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to remove member' });
  }
});

export default router;
