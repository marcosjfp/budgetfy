import { Request, Response, NextFunction } from 'express';
import admin from 'firebase-admin';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { HttpError } from '../errors.js';

if (config.firebaseProjectId && !admin.apps.length) {
  // verifyIdToken only fetches Google's public keys — no service account needed.
  admin.initializeApp({ projectId: config.firebaseProjectId });
}

export interface AuthRequest extends Request {
  uid?: string;
  /** Email asserted by the verified token (never trust the request body for this). */
  authEmail?: string | null;
  authEmailVerified?: boolean;
  authProvider?: 'local' | 'firebase';
}

interface LocalTokenPayload {
  uid: string;
  email?: string;
}

export function signLocalToken(payload: LocalTokenPayload): string {
  return jwt.sign({ uid: payload.uid, email: payload.email }, config.jwt.secret, {
    algorithm: config.jwt.algorithm,
    expiresIn: config.jwt.expiresIn as jwt.SignOptions['expiresIn'],
    issuer: config.jwt.issuer,
    audience: config.jwt.audience,
    subject: payload.uid,
  });
}

function verifyLocalToken(token: string): LocalTokenPayload {
  const decoded = jwt.verify(token, config.jwt.secret, {
    algorithms: [config.jwt.algorithm], // pin algorithm: no "none", no RS/HS confusion
    issuer: config.jwt.issuer,
    audience: config.jwt.audience,
  });
  if (typeof decoded !== 'object' || typeof decoded.uid !== 'string' || !decoded.uid) {
    throw new Error('Malformed token payload');
  }
  return { uid: decoded.uid, email: typeof decoded.email === 'string' ? decoded.email : undefined };
}

export async function requireAuth(req: AuthRequest, _res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return next(new HttpError(401, 'UNAUTHORIZED', 'Unauthorized'));
  }
  const token = authHeader.slice(7).trim();
  if (!token || token.length > 4096) {
    return next(new HttpError(401, 'INVALID_TOKEN', 'Invalid token'));
  }

  // Route by algorithm instead of "try one, then the other".
  const header = jwt.decode(token, { complete: true })?.header;
  try {
    if (header?.alg === config.jwt.algorithm) {
      const payload = verifyLocalToken(token);
      req.uid = payload.uid;
      req.authEmail = payload.email ?? null;
      req.authEmailVerified = false;
      req.authProvider = 'local';
      return next();
    }
    if (header?.alg === 'RS256' && config.firebaseProjectId) {
      const decoded = await admin.auth().verifyIdToken(token);
      req.uid = decoded.uid;
      req.authEmail = decoded.email ?? null;
      req.authEmailVerified = decoded.email_verified === true;
      req.authProvider = 'firebase';
      return next();
    }
  } catch {
    // fall through
  }
  return next(new HttpError(401, 'INVALID_TOKEN', 'Invalid or expired token'));
}
