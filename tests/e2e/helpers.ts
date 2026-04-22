import { test as base, type BrowserContext } from '@playwright/test';
import postgres from 'postgres';
import { randomBytes, createHash } from 'node:crypto';
import argon2 from '@node-rs/argon2';

const TEST_DB_URL = process.env['TEST_DATABASE_URL'];

if (!TEST_DB_URL) {
  // Don't throw at import — tests themselves check and skip, so that bare
  // `npm run test:e2e` without the env var reports skipped rather than
  // crashing the worker.
  console.warn(
    '[e2e] TEST_DATABASE_URL not set — tests will skip. Point this at a throwaway Postgres and re-run.',
  );
}

function makeClient() {
  if (!TEST_DB_URL) throw new Error('TEST_DATABASE_URL is required');
  return postgres(TEST_DB_URL, { prepare: false, max: 3 });
}

/**
 * Wipe every row in the app's tables — order matters for FK chains.
 * Currencies is seeded by migration and we leave it alone.
 */
export async function resetDatabase(): Promise<void> {
  const sql = makeClient();
  try {
    await sql`TRUNCATE transfers, reconciliations, transactions, payees, categories, sessions, accounts, users RESTART IDENTITY CASCADE`;
  } finally {
    await sql.end();
  }
}

export interface SeededUser {
  id: string;
  email: string;
  password: string;
  sessionToken: string;
  sessionCookie: string;
}

export async function seedUserAndSession(
  email = 'e2e@example.com',
  password = 'e2e-password-1234',
): Promise<SeededUser> {
  const sql = makeClient();
  try {
    const passwordHash = await argon2.hash(password, {
      memoryCost: 19456,
      timeCost: 2,
      outputLen: 32,
      parallelism: 1,
    });
    const [user] = await sql<{ id: string }[]>`
      INSERT INTO users (email, password_hash)
      VALUES (${email}, ${passwordHash})
      RETURNING id
    `;
    const userId = user!.id;

    const token = randomBytes(24).toString('base64url');
    const sessionId = createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await sql`
      INSERT INTO sessions (id, user_id, expires_at)
      VALUES (${sessionId}, ${userId}, ${expiresAt})
    `;

    return {
      id: userId,
      email,
      password,
      sessionToken: token,
      sessionCookie: `cr_session=${token}`,
    };
  } finally {
    await sql.end();
  }
}

export async function applySessionCookie(
  context: BrowserContext,
  baseURL: string,
  token: string,
): Promise<void> {
  const url = new URL(baseURL);
  await context.addCookies([
    {
      name: 'cr_session',
      value: token,
      domain: url.hostname,
      path: '/',
      httpOnly: true,
      secure: false,
      sameSite: 'Lax',
      expires: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
    },
  ]);
}

export const test = base.extend({});
export { expect } from '@playwright/test';
