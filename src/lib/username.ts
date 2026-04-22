// Username rules: 3–32 chars, lowercase letters, digits, underscore, dot,
// hyphen. Must start and end with an alphanumeric. All comparisons are
// case-insensitive; storage is always lowercase.

const USERNAME_RE = /^[a-z0-9](?:[a-z0-9._-]{1,30}[a-z0-9])?$/;

export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase();
}

export function isValidUsername(candidate: string): boolean {
  return USERNAME_RE.test(candidate);
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
