// Username rules: 3–32 chars, lowercase letters, digits, underscore, dot,
// hyphen. Must start and end with an alphanumeric. All comparisons are
// case-insensitive; storage is always lowercase.

const USERNAME_RE = /^[a-z0-9](?:[a-z0-9._-]{1,30}[a-z0-9])?$/;
const MAX_NAME = 64;

export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase();
}

export function isValidUsername(candidate: string): boolean {
  return USERNAME_RE.test(candidate);
}

export function normalizeName(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ');
}

export function isValidName(candidate: string): boolean {
  if (candidate.length === 0) return true; // name is optional
  return candidate.length <= MAX_NAME;
}

export function usernameInitials(username: string): string {
  const cleaned = username.trim();
  if (!cleaned) return '??';
  const parts = cleaned.split(/[._-]+/).filter((p) => p.length > 0);
  const letters = parts
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
  return letters || cleaned[0]!.toUpperCase();
}

/**
 * Initials for an avatar. Prefers the display name when set — e.g. 'John Doe'
 * → 'JD'. Falls back to the username-derived initials.
 */
export function personInitials(name: string | null | undefined, username: string): string {
  const n = (name ?? '').trim();
  if (n) {
    const parts = n.split(/\s+/).filter((p) => p.length > 0);
    const letters = parts
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? '')
      .join('');
    if (letters) return letters;
  }
  return usernameInitials(username);
}

/**
 * Human-readable label — prefers the name when set, else the username with
 * an @ prefix.
 */
export function personLabel(name: string | null | undefined, username: string): string {
  const n = (name ?? '').trim();
  return n || `@${username}`;
}
