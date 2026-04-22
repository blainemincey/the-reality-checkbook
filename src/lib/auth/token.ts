import { randomBytes, createHash } from 'node:crypto';

/**
 * Session-token hygiene: the cookie carries a random token; the DB stores its
 * SHA-256. A DB leak therefore does not give an attacker usable cookies.
 */
export function generateSessionToken(): string {
  return randomBytes(24).toString('base64url');
}

export function hashSessionToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
