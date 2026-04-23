// Runtime migration runner for the Docker image.
//
// We don't ship drizzle-kit in production — instead, we use drizzle-orm's
// programmatic migrator, which reads the same .sql files drizzle-kit would
// apply. Runs at container start via docker-entrypoint.sh.

import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('[migrate] DATABASE_URL is not set — aborting.');
  process.exit(1);
}

const migrationsFolder =
  process.env.MIGRATIONS_FOLDER ?? path.resolve(__dirname, '../migrations');

const sql = postgres(url, { max: 1, prepare: false });
const db = drizzle(sql);

try {
  console.log(`[migrate] applying migrations from ${migrationsFolder}`);
  await migrate(db, { migrationsFolder });
  console.log('[migrate] up to date');
} catch (err) {
  console.error('[migrate] failed:', err);
  process.exitCode = 1;
} finally {
  await sql.end({ timeout: 5 });
}
