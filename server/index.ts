import express from 'express';
import cors from 'cors';
import helmet from 'helmet';

// Must be imported first: validates env and fails fast on insecure configuration.
import { config } from './config.js';
import { errorHandler, HttpError, notFoundHandler } from './errors.js';
import { apiLimiter } from './middleware/rateLimit.js';

import authRoutes from './routes/auth.js';
import usersRoutes from './routes/users.js';
import groupsRoutes from './routes/groups.js';
import expensesRoutes from './routes/expenses.js';
import settlementsRoutes from './routes/settlements.js';

const app = express();

app.set('trust proxy', config.trustProxy);
app.disable('x-powered-by');

app.use(helmet());
app.use(
  cors((req, callback) => {
    const origin = req.headers.origin;
    const base = {
      methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      maxAge: 600,
    };
    // Same-origin / non-browser requests carry no Origin header.
    if (!origin || config.corsOrigins.includes(origin)) return callback(null, { ...base, origin: true });
    // Browsers also send Origin on same-origin POSTs: allow requests from the site serving this API.
    try {
      if (new URL(origin).host === req.headers.host) return callback(null, { ...base, origin: true });
    } catch {
      // Malformed Origin header: fall through to rejection.
    }
    callback(new HttpError(403, 'CORS_REJECTED', 'Origin not allowed'));
  }),
);
app.use(express.json({ limit: '100kb' }));

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api', apiLimiter);
app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/groups', groupsRoutes);
app.use('/api/groups/:id/expenses', expensesRoutes);
app.use('/api/groups/:id/settlements', settlementsRoutes);

app.use('/api', notFoundHandler);
app.use(errorHandler);

// On Vercel the app is exported as a serverless function (see api/index.ts); locally it listens on a port.
if (!process.env.VERCEL) {
  app.listen(config.port, () => {
    console.log(`API Server running on port ${config.port} (${config.nodeEnv})`);
  });
}

export default app;
