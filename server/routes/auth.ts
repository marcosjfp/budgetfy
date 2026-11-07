import { Router } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { eq, sql } from 'drizzle-orm';
import { db, DbInsert, DbUpdate } from '../db.js';
import { users } from '../schema.js';
import { config } from '../config.js';
import { asyncHandler, HttpError } from '../errors.js';
import { requireAuth, signLocalToken, verifyFirebaseIdToken, type AuthRequest } from '../middleware/auth.js';
import { createEmailToken, consumeEmailToken } from '../emailTokens.js';
import { sendAccountEmail, type EmailLang } from '../email.js';
import { emailLimiter, loginLimiter, registerLimiter } from '../middleware/rateLimit.js';
import {
  firebaseLoginSchema,
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resendVerificationSchema,
  resetPasswordSchema,
  verifyEmailSchema,
} from '../validation.js';

const router = Router();

// Used to equalise response time when the account doesn't exist (prevents timing-based enumeration).
const DUMMY_HASH = bcrypt.hashSync(crypto.randomBytes(16).toString('hex'), config.bcryptRounds);

function publicUser(user: typeof users.$inferSelect) {
  return { uid: user.uid, email: user.email, displayName: user.displayName, photoURL: user.photoURL, emailVerified: user.emailVerified };
}

/** Sends a verify/reset email; failures are logged and reported as false (never leak details). */
async function trySendAccountEmail(kind: 'verify' | 'reset', user: typeof users.$inferSelect, lang: EmailLang): Promise<boolean> {
  if (!user.email) return false;
  try {
    const token = await createEmailToken(user.uid, kind);
    await sendAccountEmail(kind, user.email, user.displayName ?? '', token, lang);
    return true;
  } catch (err) {
    console.error(`[email] ${kind} email failed:`, (err as Error).message);
    return false;
  }
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
    const { email, password, displayName, lang } = registerSchema.parse(req.body);

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

    // Don't block sign-up if the email can't be sent; the app offers "resend".
    const verificationSent = await trySendAccountEmail('verify', user, lang ?? 'en');

    const token = signLocalToken({ uid: user.uid, email: user.email ?? undefined, ver: user.tokenVersion ?? 0 });
    res.status(201).json({ token, user: publicUser(user), verificationSent });
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

    const token = signLocalToken({ uid: user.uid, email: user.email ?? undefined, ver: user.tokenVersion ?? 0 });
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
      const updates: { firebaseUid?: string; email?: string; photoURL?: string; emailVerified?: boolean; passwordHash?: null; tokenVersion?: unknown } = {};
      if (!user.firebaseUid) updates.firebaseUid = decoded.uid;
      const matchedByEmail = !!email && user.email?.toLowerCase() === email && user.uid !== decoded.uid && user.firebaseUid !== decoded.uid;
      if (matchedByEmail && !user.emailVerified) {
        // Pre-hijacking guard: someone may have registered this address with a password before its
        // real owner. Google just proved ownership, so drop that unproven password and end its sessions.
        updates.passwordHash = null;
        updates.tokenVersion = sql`${users.tokenVersion} + 1`;
      }
      if (email && user.email?.toLowerCase() === email && !user.emailVerified) updates.emailVerified = true;
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
            emailVerified: !!email,
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

    const token = signLocalToken({ uid: user.uid, email: user.email ?? undefined, ver: user.tokenVersion ?? 0 });
    res.json({ token, user: publicUser(user) });
  }),
);

// POST /api/auth/verify-email — { token } from the email link
router.post(
  '/verify-email',
  loginLimiter,
  asyncHandler(async (req, res) => {
    const { token } = verifyEmailSchema.parse(req.body);
    const uid = await consumeEmailToken(token, 'verify');
    if (!uid) throw new HttpError(400, 'INVALID_EMAIL_TOKEN', 'Invalid or expired link');
    await db.update(users).set({ emailVerified: true } as DbUpdate<typeof users>).where(eq(users.uid, uid));
    res.json({ ok: true });
  }),
);

// POST /api/auth/resend-verification — signed-in users whose email isn't verified yet
router.post(
  '/resend-verification',
  requireAuth,
  emailLimiter,
  asyncHandler<AuthRequest>(async (req, res) => {
    const { lang } = resendVerificationSchema.parse(req.body ?? {});
    const user = await findUserBy(users.uid, req.uid!);
    if (!user) throw new HttpError(404, 'USER_NOT_FOUND', 'User not found');
    if (user.emailVerified) return void res.json({ ok: true, alreadyVerified: true });
    if (!(await trySendAccountEmail('verify', user, lang ?? 'en'))) {
      throw new HttpError(503, 'EMAIL_SEND_FAILED', 'Could not send the email');
    }
    res.json({ ok: true });
  }),
);

// POST /api/auth/forgot-password — { email, lang? }. Always answers the same way, so it can't be
// used to find out which emails have accounts.
router.post(
  '/forgot-password',
  emailLimiter,
  asyncHandler(async (req, res) => {
    const { email, lang } = forgotPasswordSchema.parse(req.body);
    const user = await findUserByEmail(email);
    if (user) await trySendAccountEmail('reset', user, lang ?? 'en');
    res.json({ ok: true });
  }),
);

// POST /api/auth/reset-password — { token, password }. Sets the password, marks the email verified
// (the link proved access to the inbox) and signs out every existing session.
router.post(
  '/reset-password',
  loginLimiter,
  asyncHandler(async (req, res) => {
    const { token, password } = resetPasswordSchema.parse(req.body);
    const uid = await consumeEmailToken(token, 'reset');
    if (!uid) throw new HttpError(400, 'INVALID_EMAIL_TOKEN', 'Invalid or expired link');
    const passwordHash = await bcrypt.hash(password, config.bcryptRounds);
    await db
      .update(users)
      .set({ passwordHash, emailVerified: true, tokenVersion: sql`${users.tokenVersion} + 1` } as DbUpdate<typeof users>)
      .where(eq(users.uid, uid));
    res.json({ ok: true });
  }),
);

export default router;
