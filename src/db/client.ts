import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const connectionString = process.env['DATABASE_URL'];
if (!connectionString) {
  throw new Error('DATABASE_URL is not set');
}

// postgres-js returns NUMERIC as string by default — exactly what we want.
// Do NOT install a numeric parser; strings flow straight into Cash/Quantity/Price.
const client = postgres(connectionString, {
  prepare: false,
  max: 10,
});

export const db = drizzle(client, { schema, casing: 'snake_case' });
export type DB = typeof db;
