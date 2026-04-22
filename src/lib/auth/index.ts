import { readSessionToken } from './cookies';
import { validateSessionToken, type SessionValidation } from './session';

export { hashPassword, verifyPassword, PasswordError } from './password';
export {
  createSession,
  validateSessionToken,
  invalidateSession,
  invalidateAllUserSessions,
  generateSessionToken,
  hashSessionToken,
  type SessionRow,
  type SessionValidation,
} from './session';
export { setSessionCookie, clearSessionCookie, readSessionToken } from './cookies';

/**
 * Read the session cookie and resolve the current user. Returns { user: null,
 * session: null } if no valid cookie is present or the session has expired.
 *
 * Server-only — imports next/headers under the hood.
 */
export async function auth(): Promise<SessionValidation> {
  const token = await readSessionToken();
  if (!token) return { session: null, user: null };
  return validateSessionToken(token);
}
