/**
 * DANGER: wipes the entire `public` schema of the configured database.
 *
 * Usage (development only):  npx tsx drop.ts --yes
 *
 * Refuses to run when NODE_ENV=production, and requires the explicit `--yes` flag.
 * Remote (non-localhost) databases additionally require ALLOW_REMOTE_DROP=true.
 */
import { sql } from 'drizzle-orm';

if ((process.env.NODE_ENV || '').toLowerCase() === 'production') {
  console.error('Refusing to drop the database schema: NODE_ENV=production.');
  process.exit(1);
}
if (!process.argv.includes('--yes')) {
  console.error('This permanently deletes ALL data in the `public` schema. Re-run with --yes to confirm.');
  process.exit(1);
}

// Import after the guards so nothing connects unless confirmed.
const { config } = await import('./server/config.js');
const host = new URL(config.databaseUrl).hostname;
const isLocal = ['localhost', '127.0.0.1', '::1', '[::1]'].includes(host);
if (config.isProduction || (!isLocal && process.env.ALLOW_REMOTE_DROP !== 'true')) {
  console.error(`Refusing to drop schema on non-local host "${host}". Set ALLOW_REMOTE_DROP=true to override.`);
  process.exit(1);
}

const { db } = await import('./server/db.js');
console.log(`Dropping schema "public" on ${host}...`);
try {
  await db.execute(sql`DROP SCHEMA public CASCADE; CREATE SCHEMA public;`);
  console.log('Done.');
  process.exit(0);
} catch (err) {
  console.error('Drop failed:', err);
  process.exit(1);
}
