import { and, eq } from 'drizzle-orm';
import { db } from '../db.js';
import { groupMembers, groups } from '../schema.js';
import { HttpError } from '../errors.js';

export type Membership = typeof groupMembers.$inferSelect;
export type Group = typeof groups.$inferSelect;

export async function getMembership(groupId: string, userId: string): Promise<Membership | undefined> {
  const [member] = await db
    .select()
    .from(groupMembers)
    .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId)))
    .limit(1);
  return member;
}

/**
 * Throws 403 unless `userId` is a member of `groupId`.
 * Non-existent groups also yield 403 so group ids can't be probed.
 */
export async function requireMembership(groupId: string, userId: string): Promise<Membership> {
  const member = await getMembership(groupId, userId);
  if (!member) throw new HttpError(403, 'NOT_A_MEMBER', 'You are not a member of this group');
  return member;
}

export async function requireAdmin(groupId: string, userId: string): Promise<Membership> {
  const member = await requireMembership(groupId, userId);
  if (member.role !== 'admin') throw new HttpError(403, 'ADMIN_REQUIRED', 'Only group admins can do this');
  return member;
}

/** Loads the group after confirming membership. */
export async function requireGroupForMember(groupId: string, userId: string): Promise<{ group: Group; member: Membership }> {
  const member = await requireMembership(groupId, userId);
  const [group] = await db.select().from(groups).where(eq(groups.id, groupId)).limit(1);
  if (!group) throw new HttpError(404, 'GROUP_NOT_FOUND', 'Group not found');
  return { group, member };
}
