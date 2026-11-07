import rateLimit, { type Options } from 'express-rate-limit';
import type { ErrorBody } from '../errors.js';

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
});

/** Account-creation / email-enumeration throttling. */
export const registerLimiter = rateLimit({
  ...common,
  windowMs: 60 * 60 * 1000,
  limit: 10,
});

/** Throttle email lookups (user search / add member) to slow enumeration. */
export const lookupLimiter = rateLimit({
  ...common,
  windowMs: 15 * 60 * 1000,
  limit: 30,
});

/** Coarse global limit for the whole API. */
export const apiLimiter = rateLimit({
  ...common,
  windowMs: 60 * 1000,
  limit: 300,
});
