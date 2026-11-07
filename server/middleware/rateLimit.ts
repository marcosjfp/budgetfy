import rateLimit, { type Options, type Store, type IncrementResponse } from 'express-rate-limit';
import { sql } from 'drizzle-orm';
import { db } from '../db.js';
import type { ErrorBody } from '../errors.js';

/**
 * express-rate-limit store backed by Postgres, so every serverless instance shares the same
 * counters (in-memory counters reset per instance and barely limit anything on Vercel).
 * Fixed window per key: the first hit sets reset_at = now + window.
 */
class PostgresStore implements Store {
  windowMs = 60_000;
  // Counters live in the database, not in this process.
  localKeys = false;
  constructor(public prefix: string) {}

  init(options: Options) {
    this.windowMs = options.windowMs;
  }

  async increment(key: string): Promise<IncrementResponse> {
    const k = this.prefix + key;
    const result = await db.execute<{ hits: number; reset_at: Date | string }>(sql`
      INSERT INTO rate_limits (key, hits, reset_at)
      VALUES (${k}, 1, now() + make_interval(secs => ${this.windowMs / 1000}))
      ON CONFLICT (key) DO UPDATE SET
        hits = CASE WHEN rate_limits.reset_at <= now() THEN 1 ELSE rate_limits.hits + 1 END,
        reset_at = CASE WHEN rate_limits.reset_at <= now() THEN excluded.reset_at ELSE rate_limits.reset_at END
      RETURNING hits, reset_at`);
    // Occasionally clear out expired counters so the table stays tiny.
    if (Math.random() < 0.02) {
      db.execute(sql`DELETE FROM rate_limits WHERE reset_at < now() - interval '1 hour'`).catch(() => undefined);
    }
    const row = result.rows[0];
    return { totalHits: Number(row.hits), resetTime: new Date(row.reset_at) };
  }

  async decrement(key: string) {
    await db.execute(sql`UPDATE rate_limits SET hits = greatest(hits - 1, 0) WHERE key = ${this.prefix + key}`);
  }

  async resetKey(key: string) {
    await db.execute(sql`DELETE FROM rate_limits WHERE key = ${this.prefix + key}`);
  }
}

const handler: Options['handler'] = (_req, res, _next, options) => {
  res.status(options.statusCode).json({
    error: 'Too many requests, please try again later.',
    code: 'RATE_LIMITED',
  } satisfies ErrorBody);
};

const common = {
  standardHeaders: 'draft-7' as const,
  legacyHeaders: false,
  handler,
};

/** Login brute-force protection: failed attempts only. */
export const loginLimiter = rateLimit({
  ...common,
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  store: new PostgresStore('login:'),
});

/** Account-creation / email-enumeration throttling. */
export const registerLimiter = rateLimit({
  ...common,
  windowMs: 60 * 60 * 1000,
  limit: 10,
  store: new PostgresStore('register:'),
});

/** Throttle email lookups (user search / add member) to slow enumeration. */
export const lookupLimiter = rateLimit({
  ...common,
  windowMs: 15 * 60 * 1000,
  limit: 30,
  store: new PostgresStore('lookup:'),
});

/** Emails sent on request (verification resend, password reset): stops inbox flooding. */
export const emailLimiter = rateLimit({
  ...common,
  windowMs: 60 * 60 * 1000,
  limit: 5,
  store: new PostgresStore('email:'),
});

/** Coarse global limit for the whole API (in memory per instance, to avoid a DB write on every request). */
export const apiLimiter = rateLimit({
  ...common,
  windowMs: 60 * 1000,
  limit: 300,
});
