import crypto from 'crypto';
import { and, eq, gt, isNull, sql } from 'drizzle-orm';
import { db, DbInsert, DbUpdate } from './db.js';
import { emailTokens } from './schema.js';

export type TokenPurpose = 'verify' | 'reset';

const TTL_MS: Record<TokenPurpose, number> = {
  verify: 48 * 60 * 60 * 1000, // 48 hours
  reset: 60 * 60 * 1000, // 1 hour
};

const hash = (token: string) => crypto.createHash('sha256').update(token).digest('hex');

/** Creates a single-use token (replacing older unused ones of the same purpose) and returns it. */
export async function createEmailToken(userId: string, purpose: TokenPurpose): Promise<string> {
  const token = crypto.randomBytes(32).toString('base64url');
  await db.delete(emailTokens).where(and(eq(emailTokens.userId, userId), eq(emailTokens.purpose, purpose), isNull(emailTokens.usedAt)));
  await db.insert(emailTokens).values({
    userId,
    purpose,
    tokenHash: hash(token),
    expiresAt: new Date(Date.now() + TTL_MS[purpose]),
  } as DbInsert<typeof emailTokens>);
  // Keep the table small: drop tokens that expired over a day ago.
  db.delete(emailTokens).where(sql`${emailTokens.expiresAt} < now() - interval '1 day'`).catch(() => undefined);
  return token;
}

/** Marks a valid, unused, unexpired token as used (atomically) and returns its user id, else null. */
export async function consumeEmailToken(token: string, purpose: TokenPurpose): Promise<string | null> {
  const [row] = await db
    .update(emailTokens)
    .set({ usedAt: new Date() } as DbUpdate<typeof emailTokens>)
    .where(
      and(
        eq(emailTokens.tokenHash, hash(token)),
        eq(emailTokens.purpose, purpose),
        isNull(emailTokens.usedAt),
        gt(emailTokens.expiresAt, new Date()),
      ),
    )
    .returning({ userId: emailTokens.userId });
  return row?.userId ?? null;
}
