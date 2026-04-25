import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

function createDb(connectionString: string) {
  // postgres-js returns NUMERIC as string by default — exactly what we want.
  // Do NOT install a numeric parser; strings flow straight into Cash/Quantity/Price.
  const client = postgres(connectionString, {
    prepare: false,
    max: 10,
  });
  return drizzle(client, { schema, casing: 'snake_case' });
}

type DrizzleDB = ReturnType<typeof createDb>;
let _db: DrizzleDB | undefined;

function getDb(): DrizzleDB {
  if (_db) return _db;
  const connectionString = process.env['DATABASE_URL'];
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set');
  }
  _db = createDb(connectionString);
  return _db;
}

// Lazy: open the connection on first method use, not at module load. Lets
// `next build` statically analyse pages without DATABASE_URL set — the value
// is only required at request time.
export const db = new Proxy({} as DrizzleDB, {
  get(_t, prop) {
    const target = getDb() as unknown as Record<PropertyKey, unknown>;
    const value = target[prop];
    return typeof value === 'function'
      ? (value as (...a: unknown[]) => unknown).bind(target)
      : value;
  },
});
export type DB = DrizzleDB;
