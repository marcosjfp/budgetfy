import { auth } from './firebase';
import { getLang, translate } from './i18n/core';
import { translateApiError } from './i18n/serverErrors';

const BASE_URL = '/api';

export const TOKEN_KEY = 'budgetfy_token';
export const USER_KEY = 'budgetfy_user';

/** Fired on window when the API rejects our token; App returns to the login screen. */
export const SESSION_EXPIRED_EVENT = 'budgetfy:session-expired';

/** Error thrown by apiFetch/authFetch. `message` is the raw (English) server message. */
export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function clearLocalSession() {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  } catch {
    // ignore
  }
}

async function toApiError(response: Response): Promise<ApiError> {
  const body = await response.json().catch(() => ({} as Record<string, unknown>));
  const message = typeof body.error === 'string' ? body.error : `HTTP error! status: ${response.status}`;
  return new ApiError(message, response.status, typeof body.code === 'string' ? body.code : undefined, body.details);
}

async function send(endpoint: string, options: RequestInit, token: string | null) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  try {
    return await fetch(`${BASE_URL}${endpoint}`, { ...options, headers });
  } catch {
    throw new ApiError('Network error', 0, 'NETWORK_ERROR');
  }
}

async function parseBody(response: Response) {
  if (response.status === 204 || response.headers.get('content-length') === '0') return null;
  return response.json();
}

export async function apiFetch(endpoint: string, options: RequestInit = {}) {
  let token: string | null = null;

  // Try Firebase token first, then the local (email/password) token.
  if (auth?.currentUser) {
    token = await auth.currentUser.getIdToken();
  } else {
    token = localStorage.getItem(TOKEN_KEY);
  }

  const response = await send(endpoint, options, token);

  if (!response.ok) {
    const error = await toApiError(response);
    if (response.status === 401 && (error.code === 'INVALID_TOKEN' || error.code === 'UNAUTHORIZED')) {
      clearLocalSession();
      window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT));
    }
    throw error;
  }

  return parseBody(response);
}

/** Unauthenticated JSON POST (login/register). Never triggers session-expiry handling. */
export async function authFetch<T = unknown>(endpoint: string, body: unknown): Promise<T> {
  const response = await send(endpoint, { method: 'POST', body: JSON.stringify(body) }, null);
  if (!response.ok) throw await toApiError(response);
  return parseBody(response) as Promise<T>;
}

/** Human-readable, translated message for any error thrown by the API layer. */
export function describeError(error: unknown): string {
  const lang = getLang();
  if (error instanceof ApiError) {
    if (error.code === 'NETWORK_ERROR') return translate(lang, 'serverError.network');
    return translateApiError(lang, { message: error.message, code: error.code, details: error.details });
  }
  if (error instanceof Error) return translateApiError(lang, { message: error.message });
  return translateApiError(lang, { message: String(error) });
}
