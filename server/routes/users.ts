import { Router } from 'express';
import { and, eq, ne, sql } from 'drizzle-orm';
import { db, DbInsert, DbUpdate } from '../db.js';
import { groupMembers, users } from '../schema.js';
import { asyncHandler, HttpError } from '../errors.js';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import { lookupLimiter } from '../middleware/rateLimit.js';
import { syncUserSchema, updateProfileSchema, userSearchQuerySchema } from '../validation.js';

const router = Router();

/** Only ever expose these columns (never password_hash). */
const publicColumns = {
  uid: users.uid,
  displayName: users.displayName,
  email: users.email,
  photoURL: users.photoURL,
  createdAt: users.createdAt,
};

/** The signed-in user's own profile: public columns + synced preferences. */
const selfColumns = { ...publicColumns, preferences: users.preferences };

async function loadSelf(uid: string) {
  const [user] = await db.select(selfColumns).from(users).where(eq(users.uid, uid)).limit(1);
  if (!user) throw new HttpError(404, 'USER_NOT_FOUND', 'User not found');
  return { ...user, preferences: (user.preferences as Record<string, unknown> | null) ?? {} };
}

// POST /api/users/sync — upsert user profile on login
router.post(
  '/sync',
  requireAuth,
  asyncHandler<AuthRequest>(async (req, res) => {
    const uid = req.uid!;
    const { displayName, photoURL } = syncUserSchema.parse(req.body ?? {});

    // Email comes from the verified token, never from the body (prevents claiming someone else's email).
    // Firebase emails are only trusted when verified by the provider.
    let email: string | null = null;
    if (req.authEmail && (req.authProvider === 'local' || req.authEmailVerified)) {
      email = req.authEmail.toLowerCase();
      const [taken] = await db
        .select({ uid: users.uid })
        .from(users)
        .where(and(sql`lower(${users.email}) = ${email}`, ne(users.uid, uid)))
        .limit(1);
      if (taken) email = null; // belongs to another account; don't link it
    }

    // Only overwrite fields the client actually sent.
    const profile: { displayName?: string | null; photoURL?: string | null; email?: string } = {};
    if (displayName !== undefined) profile.displayName = displayName;
    if (photoURL !== undefined) profile.photoURL = photoURL;
    if (email) profile.email = email;

    const insert = db.insert(users).values({ uid, ...profile } as DbInsert<typeof users>);
    if (Object.keys(profile).length > 0) {
      const set: Record<string, unknown> = { ...profile };
      // A name edited in Budgetfy (PATCH /me) wins over the identity provider's name on later logins.
      if (profile.displayName !== undefined) set.displayName = sql`coalesce(${users.displayName}, excluded.display_name)`;
      await insert.onConflictDoUpdate({ target: users.uid, set: set as DbUpdate<typeof users> });
    } else {
      await insert.onConflictDoNothing({ target: users.uid });
    }

    const [user] = await db.select(publicColumns).from(users).where(eq(users.uid, uid)).limit(1);
    res.json(user);
  }),
);

// GET /api/users/me — own profile + preferences ({ language?, currency?, theme? })
router.get(
  '/me',
  requireAuth,
  asyncHandler<AuthRequest>(async (req, res) => {
    res.json(await loadSelf(req.uid!));
  }),
);

// PATCH /api/users/me — { displayName?, preferences?: { language?, currency?, theme? } }
// Preferences are merged into the stored object (send only what changed).
router.patch(
  '/me',
  requireAuth,
  asyncHandler<AuthRequest>(async (req, res) => {
    const uid = req.uid!;
    const { displayName, preferences } = updateProfileSchema.parse(req.body ?? {});
    await loadSelf(uid); // 404 if the profile row doesn't exist yet

    await db.transaction(async (tx) => {
      const set: Record<string, unknown> = {};
      if (displayName !== undefined) set.displayName = displayName;
      if (preferences !== undefined) {
        set.preferences = sql`coalesce(${users.preferences}, '{}'::jsonb) || ${JSON.stringify(preferences)}::jsonb`;
      }
      await tx.update(users).set(set as DbUpdate<typeof users>).where(eq(users.uid, uid));
      // group_members keeps a denormalised copy of the name for member lists.
      if (displayName !== undefined) {
        await tx.update(groupMembers).set({ displayName } as DbUpdate<typeof groupMembers>).where(eq(groupMembers.userId, uid));
      }
    });

    res.json(await loadSelf(uid));
  }),
);

// GET /api/users/search?email= — exact (case-insensitive) lookup, for adding members
router.get(
  '/search',
  requireAuth,
  lookupLimiter,
  asyncHandler<AuthRequest>(async (req, res) => {
    const parsed = userSearchQuerySchema.safeParse(req.query);
    if (!parsed.success) throw new HttpError(400, 'VALIDATION_ERROR', 'A valid email query parameter is required');

    // Exact match only — no LIKE wildcards, so this can't be used to dump the user table.
    const results = await db
      .select({ uid: users.uid, displayName: users.displayName, email: users.email, photoURL: users.photoURL })
      .from(users)
      .where(sql`lower(${users.email}) = ${parsed.data.email}`)
      .limit(1);
    res.json(results);
  }),
);

export default router;
