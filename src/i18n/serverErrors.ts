import { translate, type Lang, type TranslationKey } from './core';

/** Machine-readable error codes returned by the API (mirror of server/errors.ts). */
export type ApiErrorCode =
  | 'VALIDATION_ERROR'
  | 'INVALID_JSON'
  | 'PAYLOAD_TOO_LARGE'
  | 'UNAUTHORIZED'
  | 'INVALID_TOKEN'
  | 'INVALID_CREDENTIALS'
  | 'EMAIL_IN_USE'
  | 'ACCOUNT_LINK_CONFLICT'
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
  | 'EXPENSE_FORBIDDEN'
  | 'INVALID_EMAIL_TOKEN'
  | 'EMAIL_SEND_FAILED'
  | 'SETTLEMENT_NOT_FOUND'
  | 'INVALID_SETTLEMENT'
  | 'RATE_LIMITED'
  | 'CORS_REJECTED'
  | 'INTERNAL_ERROR';

export interface ApiErrorDetail {
  path?: string;
  message?: string;
}

/** Shape of an API error body: `{ error, code, details? }`. */
export interface ApiErrorLike {
  message?: string;
  code?: string;
  details?: unknown;
}

const CODE_KEYS: Record<ApiErrorCode, TranslationKey> = {
  VALIDATION_ERROR: 'serverError.code.VALIDATION_ERROR',
  INVALID_JSON: 'serverError.code.INVALID_JSON',
  PAYLOAD_TOO_LARGE: 'serverError.code.PAYLOAD_TOO_LARGE',
  UNAUTHORIZED: 'serverError.code.UNAUTHORIZED',
  INVALID_TOKEN: 'serverError.code.INVALID_TOKEN',
  INVALID_CREDENTIALS: 'serverError.code.INVALID_CREDENTIALS',
  EMAIL_IN_USE: 'serverError.code.EMAIL_IN_USE',
  ACCOUNT_LINK_CONFLICT: 'serverError.code.ACCOUNT_LINK_CONFLICT',
  WEAK_PASSWORD: 'serverError.code.WEAK_PASSWORD',
  FORBIDDEN: 'serverError.code.FORBIDDEN',
  NOT_A_MEMBER: 'serverError.code.NOT_A_MEMBER',
  ADMIN_REQUIRED: 'serverError.code.ADMIN_REQUIRED',
  OWNER_REQUIRED: 'serverError.code.OWNER_REQUIRED',
  OWNER_PROTECTED: 'serverError.code.OWNER_PROTECTED',
  NOT_FOUND: 'serverError.code.NOT_FOUND',
  GROUP_NOT_FOUND: 'serverError.code.GROUP_NOT_FOUND',
  EXPENSE_NOT_FOUND: 'serverError.code.EXPENSE_NOT_FOUND',
  MEMBER_NOT_FOUND: 'serverError.code.MEMBER_NOT_FOUND',
  USER_NOT_FOUND: 'serverError.code.USER_NOT_FOUND',
  ALREADY_MEMBER: 'serverError.code.ALREADY_MEMBER',
  PAYER_NOT_MEMBER: 'serverError.code.PAYER_NOT_MEMBER',
  EXPENSE_FORBIDDEN: 'serverError.code.EXPENSE_FORBIDDEN',
  INVALID_EMAIL_TOKEN: 'serverError.code.INVALID_EMAIL_TOKEN',
  EMAIL_SEND_FAILED: 'serverError.code.EMAIL_SEND_FAILED',
  SETTLEMENT_NOT_FOUND: 'serverError.code.SETTLEMENT_NOT_FOUND',
  INVALID_SETTLEMENT: 'serverError.code.INVALID_SETTLEMENT',
  RATE_LIMITED: 'serverError.code.RATE_LIMITED',
  CORS_REJECTED: 'serverError.code.CORS_REJECTED',
  INTERNAL_ERROR: 'serverError.code.INTERNAL_ERROR',
};

/** Known validation detail messages (zod) → keys. */
const DETAIL_KEYS: Record<string, TranslationKey> = {
  'Password must be at least 8 characters': 'serverError.password.tooShort',
  'Password must be at most 72 bytes': 'serverError.password.tooLong',
  'Password must contain at least one letter and one number': 'serverError.password.letterAndNumber',
  'Display name is required': 'auth.displayNameRequired',
};

/**
 * Legacy: known English error messages returned by the API, mapped to
 * dictionary keys. Used when a response has no `code`.
 */
const MESSAGE_KEYS: Record<string, TranslationKey> = {
  'Invalid email or password.': 'serverError.invalidCredentials',
  'An account with this email already exists.': 'serverError.emailExists',
  'Missing required fields': 'serverError.missingFields',
  'Registration failed': 'auth.registrationFailed',
  'Login failed': 'auth.loginFailed',
  'Not a member': 'serverError.notMember',
  'Forbidden': 'serverError.forbidden',
  'Unauthorized': 'serverError.unauthorized',
  'Invalid token': 'serverError.unauthorized',
  'Not found': 'serverError.notFound',
  'Group not found': 'serverError.groupNotFound',
  'User is already a member': 'serverError.alreadyMember',
  'No user found with that email. They must sign in first.': 'serverError.userNotFound',
};

function isKnownCode(code: unknown): code is ApiErrorCode {
  return typeof code === 'string' && code in CODE_KEYS;
}

function firstDetail(details: unknown): ApiErrorDetail | undefined {
  if (Array.isArray(details) && details.length > 0 && typeof details[0] === 'object') {
    return details[0] as ApiErrorDetail;
  }
  return undefined;
}

/** Translate a known API error message; unknown messages pass through. */
export function translateServerError(lang: Lang, message: string): string {
  const key = MESSAGE_KEYS[message.trim()];
  return key ? translate(lang, key) : message;
}

/**
 * Translate an API error: by `code` first (with special handling for
 * validation details such as password rules), then by the English message,
 * then the raw message.
 */
export function translateApiError(lang: Lang, err: ApiErrorLike): string {
  const detail = firstDetail(err.details);

  if (err.code === 'VALIDATION_ERROR' || err.code === 'WEAK_PASSWORD') {
    if (detail?.message && DETAIL_KEYS[detail.message]) return translate(lang, DETAIL_KEYS[detail.message]);
    if (detail?.path === 'password') return translate(lang, 'serverError.password.invalid');
  }
  if (isKnownCode(err.code)) return translate(lang, CODE_KEYS[err.code]);

  const message = (err.message ?? '').trim();
  if (!message) return translate(lang, 'serverError.code.INTERNAL_ERROR');
  return translateServerError(lang, message);
}
