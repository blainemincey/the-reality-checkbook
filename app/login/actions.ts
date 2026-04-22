'use server';

import { eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { db } from '@/db/client';
import { users } from '@/db/schema';
import { verifyPassword } from '@/lib/auth/password';
import { createSession } from '@/lib/auth/session';
import { setSessionCookie, clearSessionCookie } from '@/lib/auth/cookies';
import { auth, invalidateSession } from '@/lib/auth';
import { normalizeUsername } from '@/lib/username';

export interface LoginState {
  error?: string;
}

// Dummy argon2id hash so we verify even when the user doesn't exist, to keep
// lookup timing roughly constant.
const DUMMY_HASH =
  '$argon2id$v=19$m=19456,t=2,p=1$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';

export async function loginAction(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const username = normalizeUsername(String(formData.get('username') ?? ''));
  const password = String(formData.get('password') ?? '');

  if (!username || !password) {
    return { error: 'Username and password are required.' };
  }

  const [user] = await db.select().from(users).where(eq(users.username, username));
  const ok = await verifyPassword(user?.passwordHash ?? DUMMY_HASH, password);
  if (!user || !ok) {
    return { error: 'Invalid username or password.' };
  }

  const { token, expiresAt } = await createSession(user.id);
  await setSessionCookie(token, expiresAt);
  redirect('/');
}

export async function logoutAction(): Promise<void> {
  const { session } = await auth();
  if (session) await invalidateSession(session.id);
  await clearSessionCookie();
  redirect('/login');
}
