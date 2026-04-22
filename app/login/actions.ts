'use server';

import { eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { db } from '@/db/client';
import { users } from '@/db/schema';
import { verifyPassword } from '@/lib/auth/password';
import { createSession } from '@/lib/auth/session';
import { setSessionCookie, clearSessionCookie } from '@/lib/auth/cookies';
import { auth, invalidateSession } from '@/lib/auth';

export interface LoginState {
  error?: string;
}

export async function loginAction(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const password = String(formData.get('password') ?? '');

  if (!email || !password) {
    return { error: 'Email and password are required.' };
  }

  const [user] = await db.select().from(users).where(eq(users.email, email));
  // Constant-ish time: always run verify (even with dummy hash) if no user.
  const hash =
    user?.passwordHash ??
    '$argon2id$v=19$m=19456,t=2,p=1$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
  const ok = await verifyPassword(hash, password);

  if (!user || !ok) {
    return { error: 'Invalid email or password.' };
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
