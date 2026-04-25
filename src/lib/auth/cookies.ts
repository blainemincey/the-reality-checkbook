import { cookies } from 'next/headers';

const SESSION_COOKIE = 'cr_session';

// Default: Secure in production. Override with SESSION_COOKIE_SECURE=false when
// serving over plain HTTP on a trusted LAN (no reverse proxy / TLS termination).
function isSecureCookie(): boolean {
  const explicit = process.env['SESSION_COOKIE_SECURE'];
  if (explicit !== undefined) return explicit !== 'false';
  return process.env['NODE_ENV'] === 'production';
}

export async function setSessionCookie(token: string, expiresAt: Date): Promise<void> {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: isSecureCookie(),
    sameSite: 'lax',
    path: '/',
    expires: expiresAt,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, '', {
    httpOnly: true,
    secure: isSecureCookie(),
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
}

export async function readSessionToken(): Promise<string | null> {
  const jar = await cookies();
  return jar.get(SESSION_COOKIE)?.value ?? null;
}
