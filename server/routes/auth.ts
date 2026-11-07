import { Router } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { eq, sql } from 'drizzle-orm';
import { db, DbInsert, DbUpdate } from '../db.js';
import { users } from '../schema.js';
import { config } from '../config.js';
import { asyncHandler, HttpError } from '../errors.js';
import { signLocalToken, verifyFirebaseIdToken } from '../middleware/auth.js';
import { loginLimiter, registerLimiter } from '../middleware/rateLimit.js';
import { firebaseLoginSchema, loginSchema, registerSchema } from '../validation.js';

const router = Router();

// Used to equalise response time when the account doesn't exist (prevents timing-based enumeration).
const DUMMY_HASH = bcrypt.hashSync(crypto.randomBytes(16).toString('hex'), config.bcryptRounds);

function publicUser(user: typeof users.$inferSelect) {
  return { uid: user.uid, email: user.email, displayName: user.displayName, photoURL: user.photoURL };
}

async function findUserByEmail(email: string) {
  const [user] = await db
    .select()
    .from(users)
    .where(sql`lower(${users.email}) = ${email.toLowerCase()}`)
    .limit(1);
  return user;
}

router.post(
  '/register',
  registerLimiter,
  asyncHandler(async (req, res) => {
    const { email, password, displayName } = registerSchema.parse(req.body);

    if (await findUserByEmail(email)) {
      // Note: this reveals that the email is registered. Unavoidable without an email-verification
      // flow; mitigated by registerLimiter.
      throw new HttpError(409, 'EMAIL_IN_USE', 'An account with this email already exists.');
    }

    const passwordHash = await bcrypt.hash(password, config.bcryptRounds);
    const uid = crypto.randomUUID();

    let user: typeof users.$inferSelect;
    try {
      [user] = await db
        .insert(users)
        .values({
          uid,
          email,
          passwordHash,
          displayName,
          photoURL: `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=random`,
        } as DbInsert<typeof users>)
        .returning();
    } catch (err) {
      // Unique violation from a concurrent registration.
      if ((err as { code?: string }).code === '23505') {
        throw new HttpError(409, 'EMAIL_IN_USE', 'An account with this email already exists.');
      }
      throw err;
    }

    const token = signLocalToken({ uid: user.uid, email: user.email ?? undefined });
    res.status(201).json({ token, user: publicUser(user) });
  }),
);

router.post(
  '/login',
  loginLimiter,
  asyncHandler(async (req, res) => {
    const { email, password } = loginSchema.parse(req.body);

    const user = await findUserByEmail(email);
    // Always run bcrypt so response time doesn't reveal whether the account exists.
    const validPassword = await bcrypt.compare(password, user?.passwordHash || DUMMY_HASH);

    if (!user || !user.passwordHash || !validPassword) {
      throw new HttpError(401, 'INVALID_CREDENTIALS', 'Invalid email or password.');
    }

    const token = signLocalToken({ uid: user.uid, email: user.email ?? undefined });
    res.json({ token, user: publicUser(user) });
  }),
);

async function findUserBy(column: typeof users.uid | typeof users.firebaseUid, value: string) {
  const [user] = await db.select().from(users).where(eq(column, value)).limit(1);
  return user;
}

/**
 * POST /api/auth/firebase — { idToken } from Google sign-in, exchanged for a normal Budgetfy session.
 *
 * Finds the account in this order: already linked to this Google account; a legacy account created
 * with the Firebase uid; an existing account with the same *verified* email (links it). Otherwise
 * creates a new account. The response matches /login, so the app treats both sign-ins the same way.
 */
router.post(
  '/firebase',
  loginLimiter,
  asyncHandler(async (req, res) => {
    const { idToken } = firebaseLoginSchema.parse(req.body);
    const decoded = await verifyFirebaseIdToken(idToken);
    // Only trust an email the identity provider has verified (Google always does).
    const email = decoded.email && decoded.email_verified === true ? decoded.email.toLowerCase() : null;

    let user =
      (await findUserBy(users.firebaseUid, decoded.uid)) ??
      (await findUserBy(users.uid, decoded.uid)) ??
      (email ? await findUserByEmail(email) : undefined);

    if (user) {
      if (user.firebaseUid && user.firebaseUid !== decoded.uid) {
        throw new HttpError(409, 'ACCOUNT_LINK_CONFLICT', 'This email is linked to a different Google account');
      }
      const updates: { firebaseUid?: string; email?: string; photoURL?: string } = {};
      if (!user.firebaseUid) updates.firebaseUid = decoded.uid;
      if (!user.email && email && !(await findUserByEmail(email))) updates.email = email;
      if (!user.photoURL && decoded.picture) updates.photoURL = decoded.picture;
      if (Object.keys(updates).length > 0) {
        [user] = await db.update(users).set(updates as DbUpdate<typeof users>).where(eq(users.uid, user.uid)).returning();
      }
    } else {
      try {
        [user] = await db
          .insert(users)
          .values({
            uid: decoded.uid,
            firebaseUid: decoded.uid,
            email,
            displayName: (decoded.name as string | undefined) ?? email?.split('@')[0] ?? null,
            photoURL: decoded.picture ?? null,
          } as DbInsert<typeof users>)
          .returning();
      } catch (err) {
        // Concurrent first sign-in: the other request created it.
        if ((err as { code?: string }).code !== '23505') throw err;
        user = await findUserBy(users.firebaseUid, decoded.uid);
        if (!user) throw err;
      }
    }

    const token = signLocalToken({ uid: user.uid, email: user.email ?? undefined });
    res.json({ token, user: publicUser(user) });
  }),
);

export default router;
