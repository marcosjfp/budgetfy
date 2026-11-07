import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { ZodError } from 'zod';

/**
 * Stable, machine-readable error codes. The frontend can map these to
 * localized messages; `error` stays a human-readable English fallback.
 */
export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'INVALID_JSON'
  | 'PAYLOAD_TOO_LARGE'
  | 'UNAUTHORIZED'
  | 'INVALID_TOKEN'
  | 'INVALID_CREDENTIALS'
  | 'EMAIL_IN_USE'
  | 'WEAK_PASSWORD'
  | 'FORBIDDEN'
  | 'NOT_A_MEMBER'
  | 'ADMIN_REQUIRED'
  | 'OWNER_REQUIRED'
  | 'OWNER_PROTECTED'
  | 'NOT_FOUND'
  | 'GROUP_NOT_FOUND'
  | 'EXPENSE_NOT_FOUND'
  | 'MEMBER_NOT_FOUND'
  | 'USER_NOT_FOUND'
  | 'ALREADY_MEMBER'
  | 'PAYER_NOT_MEMBER'
  | 'SETTLEMENT_NOT_FOUND'
  | 'INVALID_SETTLEMENT'
  | 'RATE_LIMITED'
  | 'CORS_REJECTED'
  | 'INTERNAL_ERROR';

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: ErrorCode,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export interface ErrorBody {
  error: string;
  code?: ErrorCode;
  details?: unknown;
}

/** Wraps an async handler so rejected promises reach the error middleware (Express 4). */
export function asyncHandler<Req extends Request = Request>(
  fn: (req: Req, res: Response, next: NextFunction) => Promise<unknown>,
): RequestHandler {
  return (req, res, next) => {
    fn(req as Req, res, next).catch(next);
  };
}

export function notFoundHandler(_req: Request, res: Response) {
  res.status(404).json({ error: 'Not found', code: 'NOT_FOUND' } satisfies ErrorBody);
}

function zodDetails(err: ZodError) {
  return err.issues.map((i) => ({ path: i.path.join('.'), message: i.message }));
}

/** Centralised error handler: never leaks stack traces or database errors to clients. */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  if (res.headersSent) return;

  if (err instanceof HttpError) {
    const body: ErrorBody = { error: err.message, code: err.code };
    if (err.details !== undefined) body.details = err.details;
    res.status(err.status).json(body);
    return;
  }

  if (err instanceof ZodError) {
    res.status(400).json({ error: 'Invalid request', code: 'VALIDATION_ERROR', details: zodDetails(err) } satisfies ErrorBody);
    return;
  }

  // body-parser errors
  const type = (err as { type?: string } | null)?.type;
  if (type === 'entity.parse.failed') {
    res.status(400).json({ error: 'Malformed JSON body', code: 'INVALID_JSON' } satisfies ErrorBody);
    return;
  }
  if (type === 'entity.too.large') {
    res.status(413).json({ error: 'Request body too large', code: 'PAYLOAD_TOO_LARGE' } satisfies ErrorBody);
    return;
  }
  const status = (err as { status?: number } | null)?.status;
  if (typeof status === 'number' && status >= 400 && status < 500) {
    res.status(status).json({ error: 'Bad request', code: 'VALIDATION_ERROR' } satisfies ErrorBody);
    return;
  }

  // Unknown error: log server-side only.
  console.error(`[error] ${req.method} ${req.originalUrl}:`, err);
  res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' } satisfies ErrorBody);
}
