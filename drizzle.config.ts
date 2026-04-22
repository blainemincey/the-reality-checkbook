import type { Config } from 'drizzle-kit';

const connectionString = process.env['DATABASE_URL'];
if (!connectionString) {
  throw new Error('DATABASE_URL is not set. See .env.example.');
}

export default {
  dialect: 'postgresql',
  schema: './src/db/schema.ts',
  out: './src/db/migrations',
  dbCredentials: {
    url: connectionString,
  },
  strict: true,
  verbose: true,
} satisfies Config;
