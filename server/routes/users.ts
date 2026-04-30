import { Router } from 'express';
import { db } from '../db.js';
import { users } from '../schema.js';
import { eq, ilike, InferInsertModel } from 'drizzle-orm';
import { requireAuth, AuthRequest } from '../middleware/auth.js';

const router = Router();

// POST /api/users/sync — upsert user profile on login
router.post('/sync', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { displayName, email, photoURL } = req.body;
    const uid = req.uid!;

    const userData = { uid, displayName, email, photoURL } as any;
    await db.insert(users).values(userData)
      .onConflictDoUpdate({
        target: users.uid,
        set: { displayName, email, photoURL } as any,
      });

    const [user] = await db.select().from(users).where(eq(users.uid, uid)).limit(1);
    res.json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to sync user' });
  }
});

// GET /api/users/search?email= — find user by email (for adding members)
router.get('/search', requireAuth, async (req: AuthRequest, res) => {
  try {
    const email = req.query.email as string;
    if (!email) return res.status(400).json({ error: 'email query param required' });

    const results = await db.select().from(users).where(ilike(users.email, email)).limit(5);
    res.json(results);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Search failed' });
  }
});

export default router;
