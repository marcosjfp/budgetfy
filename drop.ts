import { db } from './server/db.js';
import { sql } from 'drizzle-orm';
db.execute(sql`DROP SCHEMA public CASCADE; CREATE SCHEMA public;`).then(() => process.exit(0)).catch(console.error);
