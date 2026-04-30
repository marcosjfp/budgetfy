import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from '../db.js';
import { users } from '../schema.js';
import { eq } from 'drizzle-orm';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-fallback-key';

router.post('/register', async (req, res) => {
  try {
    const { email, password, displayName } = req.body;
    
    if (!email || !password || !displayName) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const [existing] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (existing) {
      return res.status(400).json({ error: 'An account with this email already exists.' });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);
    const uid = crypto.randomUUID();

    const userData: any = {
      uid,
      email,
      passwordHash,
      displayName,
      photoURL: `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=random`
    };

    const [user] = await db.insert(users).values(userData as any).returning();

    const token = jwt.sign({ uid: user.uid, email: user.email }, JWT_SECRET, { expiresIn: '7d' });

    res.status(201).json({ token, user: { uid: user.uid, email: user.email, displayName: user.displayName, photoURL: user.photoURL } });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    
    if (!user || !user.passwordHash) {
      return res.status(400).json({ error: 'Invalid email or password.' });
    }

    const validPassword = await bcrypt.compare(password, user.passwordHash);
    if (!validPassword) {
      return res.status(400).json({ error: 'Invalid email or password.' });
    }

    const token = jwt.sign({ uid: user.uid, email: user.email }, JWT_SECRET, { expiresIn: '7d' });

    res.json({ token, user: { uid: user.uid, email: user.email, displayName: user.displayName, photoURL: user.photoURL } });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

export default router;
