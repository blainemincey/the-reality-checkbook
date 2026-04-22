import { redirect } from 'next/navigation';
import { auth } from './index';
import type { SessionValidation } from './session';

/**
 * Use in server components / layouts that require an authenticated user.
 * Redirects to /login if no valid session cookie is present.
 */
export async function requireAuth(): Promise<
  SessionValidation & { user: NonNullable<SessionValidation['user']>; session: NonNullable<SessionValidation['session']> }
> {
  const result = await auth();
  if (!result.user || !result.session) {
    redirect('/login');
  }
  return result as {
    user: NonNullable<SessionValidation['user']>;
    session: NonNullable<SessionValidation['session']>;
  };
}

/**
 * Use on /login to bounce an already-authenticated user into the app.
 */
export async function redirectIfAuthed(target = '/'): Promise<void> {
  const result = await auth();
  if (result.user) redirect(target);
}
