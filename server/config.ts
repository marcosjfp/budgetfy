/**
 * Centralised, validated server configuration.
 *
 * Every server module must read configuration from here instead of touching
 * process.env directly, so that insecure setups fail fast at startup.
 */
import crypto from 'crypto';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// .env.local takes precedence over .env; real environment variables win over both.
dotenv.config({ path: path.join(ROOT, '.env.local'), quiet: true });
dotenv.config({ path: path.join(ROOT, '.env'), quiet: true });

const NODE_ENV = process.env.NODE_ENV || 'development';
const isProduction = NODE_ENV === 'production';

function fail(message: string): never {
  // Thrown at import time so the process refuses to start with an insecure config.
  throw new Error(`[config] ${message}`);
}

function warn(message: string) {
  console.warn(`[config] WARNING: ${message}`);
}

// ---------------------------------------------------------------------------
// Database
// ---------------------------------------------------------------------------
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  fail('DATABASE_URL is not set. Configure it in .env.local (see .env.example).');
}

// ---------------------------------------------------------------------------
// JWT
// ---------------------------------------------------------------------------
const KNOWN_WEAK_SECRETS = new Set([
  'super-secret-fallback-key',
  'your_secure_random_string',
  'changeme',
  'change-me',
  'secret',
  'jwt_secret',
]);
const MIN_SECRET_LENGTH = 32;

let JWT_SECRET = process.env.JWT_SECRET || '';
const secretIsWeak =
  !JWT_SECRET || JWT_SECRET.length < MIN_SECRET_LENGTH || KNOWN_WEAK_SECRETS.has(JWT_SECRET.toLowerCase());

if (secretIsWeak) {
  if (isProduction) {
    fail(
      `JWT_SECRET is missing or weak. In production it must be at least ${MIN_SECRET_LENGTH} random characters ` +
        '(e.g. `openssl rand -base64 48`).',
    );
  }
  if (!JWT_SECRET) {
    // Dev only: ephemeral random secret. Tokens are invalidated on every restart.
    JWT_SECRET = crypto.randomBytes(48).toString('base64');
    warn('JWT_SECRET is not set; using an ephemeral random secret (sessions reset on restart). Set it in .env.local.');
  } else {
    warn(`JWT_SECRET is weak (< ${MIN_SECRET_LENGTH} chars or a known placeholder). This would be rejected in production.`);
  }
}

const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
if (!/^\d+[smhd]?$/.test(JWT_EXPIRES_IN)) {
  fail('JWT_EXPIRES_IN must look like "3600", "15m", "12h" or "7d".');
}

// ---------------------------------------------------------------------------
// Firebase (ID token verification only — no service account needed)
// ---------------------------------------------------------------------------
let FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || '';
if (!FIREBASE_PROJECT_ID) {
  if (isProduction) {
    fail('FIREBASE_PROJECT_ID is not set. It is required to verify Firebase ID tokens.');
  }
  // Dev convenience: reuse the project the frontend is configured for.
  try {
    const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'firebase-applet-config.json'), 'utf8'));
    if (typeof cfg.projectId === 'string' && cfg.projectId) {
      FIREBASE_PROJECT_ID = cfg.projectId;
      warn('FIREBASE_PROJECT_ID not set; using projectId from firebase-applet-config.json (dev only).');
    }
  } catch {
    /* ignore */
  }
  if (!FIREBASE_PROJECT_ID) {
    warn('FIREBASE_PROJECT_ID not set; Firebase ID token authentication is disabled.');
  }
}

// ---------------------------------------------------------------------------
// HTTP
// ---------------------------------------------------------------------------
const PORT = Number(process.env.PORT || 3001);
if (!Number.isInteger(PORT) || PORT <= 0 || PORT > 65535) fail('PORT must be a valid TCP port.');

function parseOrigins(raw: string | undefined): string[] {
  return (raw || '')
    .split(',')
    .map((o) => o.trim().replace(/\/+$/, ''))
    .filter(Boolean);
}

let CORS_ORIGINS = parseOrigins(process.env.CORS_ORIGINS);
if (CORS_ORIGINS.includes('*')) {
  fail('CORS_ORIGINS must list explicit origins; "*" is not allowed.');
}
if (CORS_ORIGINS.length === 0) {
  const appUrl = process.env.APP_URL;
  if (appUrl && /^https?:\/\//.test(appUrl)) {
    CORS_ORIGINS = [new URL(appUrl).origin];
  } else if (!isProduction) {
    CORS_ORIGINS = ['http://localhost:3000', 'http://127.0.0.1:3000'];
  }
  // In production with nothing configured: no cross-origin access (same-origin only).
}

/** Express "trust proxy" setting. Needed behind Cloud Run / load balancers for correct client IPs. */
function parseTrustProxy(raw: string | undefined): boolean | number | string {
  if (raw === undefined || raw === '' || raw === 'false') return false;
  if (raw === 'true') return true;
  if (/^\d+$/.test(raw)) return Number(raw);
  return raw; // e.g. "loopback, 10.0.0.0/8"
}
const TRUST_PROXY = parseTrustProxy(process.env.TRUST_PROXY);

const BCRYPT_ROUNDS = Number(process.env.BCRYPT_ROUNDS || 12);
if (!Number.isInteger(BCRYPT_ROUNDS) || BCRYPT_ROUNDS < 10 || BCRYPT_ROUNDS > 15) {
  fail('BCRYPT_ROUNDS must be an integer between 10 and 15.');
}

// ---------------------------------------------------------------------------
// Email (Resend) and links in emails
// ---------------------------------------------------------------------------
// Links in emails always use APP_URL, never the request's Host header (a forged Host would
// otherwise put an attacker's domain in password-reset links).
const APP_URL = (process.env.APP_URL || (isProduction ? '' : 'http://localhost:3000')).replace(/\/+$/, '');
if (APP_URL && !/^https?:\/\//.test(APP_URL)) fail('APP_URL must start with http:// or https://');
const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
// Without a verified domain Resend only delivers from its test sender to the account owner.
const EMAIL_FROM = process.env.EMAIL_FROM || 'Budgetfy <onboarding@resend.dev>';
if (!RESEND_API_KEY) warn('RESEND_API_KEY not set; emails are printed to the server log instead of sent.');
if (isProduction && !APP_URL) warn('APP_URL not set; verification and password-reset emails are disabled.');

export const config = Object.freeze({
  nodeEnv: NODE_ENV,
  isProduction,
  port: PORT,
  databaseUrl: DATABASE_URL,
  jwt: Object.freeze({
    secret: JWT_SECRET,
    expiresIn: JWT_EXPIRES_IN,
    algorithm: 'HS256' as const,
    issuer: 'budgetfy',
    audience: 'budgetfy-api',
  }),
  firebaseProjectId: FIREBASE_PROJECT_ID || null,
  corsOrigins: CORS_ORIGINS,
  trustProxy: TRUST_PROXY,
  bcryptRounds: BCRYPT_ROUNDS,
  appUrl: APP_URL || null,
  email: Object.freeze({ resendApiKey: RESEND_API_KEY || null, from: EMAIL_FROM }),
});
