import type { PgTable } from 'drizzle-orm/pg-core';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema.js';
import { config } from './config.js';

const pool = new Pool({ connectionString: config.databaseUrl });

// Prevent an idle-client error (e.g. DB restart) from crashing the process.
pool.on('error', (err) => {
  console.error('[db] Unexpected idle client error:', err.message);
});

export const db = drizzle(pool, { schema });

// tsconfig isn't `strict`, so Drizzle's $inferInsert drops nullable columns. Route handlers build
// payloads from zod-validated, explicitly whitelisted fields and cast with these aliases.
export type DbInsert<T extends PgTable> = T['$inferInsert'];
export type DbUpdate<T extends PgTable> = Partial<T['$inferInsert']>;
