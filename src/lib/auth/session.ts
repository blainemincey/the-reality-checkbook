import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { sessions, users, type UserRow } from '@/db/schema';
import { generateSessionToken, hashSessionToken } from './token';

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const SESSION_RENEWAL_MS = 15 * 24 * 60 * 60 * 1000; // refresh when <15d remain

export interface SessionRow {
  id: string;
  userId: string;
  expiresAt: Date;
}

export interface SessionValidation {
  session: SessionRow | null;
  user: UserRow | null;
}

export { generateSessionToken, hashSessionToken };

export async function createSession(userId: string): Promise<{
  token: string;
  sessionId: string;
  expiresAt: Date;
}> {
  const token = generateSessionToken();
  const sessionId = hashSessionToken(token);
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await db.insert(sessions).values({ id: sessionId, userId, expiresAt });
  return { token, sessionId, expiresAt };
}

export async function validateSessionToken(token: string): Promise<SessionValidation> {
  const sessionId = hashSessionToken(token);
  const rows = await db
    .select({ session: sessions, user: users })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(eq(sessions.id, sessionId));

  const row = rows[0];
  if (!row) return { session: null, user: null };

  const now = Date.now();
  if (now >= row.session.expiresAt.getTime()) {
    await db.delete(sessions).where(eq(sessions.id, sessionId));
    return { session: null, user: null };
  }

  // Sliding expiration: if the session is past the renewal threshold, extend it.
  if (now >= row.session.expiresAt.getTime() - SESSION_RENEWAL_MS) {
    const newExpiresAt = new Date(now + SESSION_TTL_MS);
    await db.update(sessions).set({ expiresAt: newExpiresAt }).where(eq(sessions.id, sessionId));
    row.session.expiresAt = newExpiresAt;
  }

  return { session: row.session, user: row.user };
}

export async function invalidateSession(sessionId: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.id, sessionId));
}

export async function invalidateAllUserSessions(userId: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.userId, userId));
}
