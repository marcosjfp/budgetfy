import { Request, Response, NextFunction } from 'express';
import admin from 'firebase-admin';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env.local') });

if (!admin.apps.length) {
  // verifyIdToken only fetches Google's public keys — no service account needed.
  admin.initializeApp({
    projectId: process.env.FIREBASE_PROJECT_ID || 'gen-lang-client-0185724717',
  });
}

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-fallback-key';

export interface AuthRequest extends Request {
  uid?: string;
}

export async function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  const token = authHeader.slice(7);
  
  try {
    // Try custom JWT first
    const decoded = jwt.verify(token, JWT_SECRET) as { uid: string };
    req.uid = decoded.uid;
    return next();
  } catch (err) {
    // Fallback to Firebase verifyIdToken if custom JWT fails
    try {
      const decoded = await admin.auth().verifyIdToken(token);
      req.uid = decoded.uid;
      return next();
    } catch (firebaseErr) {
      console.error('Token verification failed');
      return res.status(401).json({ error: 'Invalid token' });
    }
  }
}
