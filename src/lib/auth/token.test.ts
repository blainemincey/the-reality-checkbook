import { describe, it, expect } from 'vitest';
import { generateSessionToken, hashSessionToken } from './token';

// Pure-function tests only. DB-backed behavior (createSession,
// validateSessionToken, invalidateSession, sliding expiration) is covered by
// the integration suite that runs against a throwaway Postgres container.

describe('generateSessionToken', () => {
  it('returns URL-safe base64 of sufficient length', () => {
    const token = generateSessionToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    // 24 random bytes → 32 base64url chars
    expect(token.length).toBe(32);
  });

  it('produces unique tokens across calls', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 1000; i++) seen.add(generateSessionToken());
    expect(seen.size).toBe(1000);
  });
});

describe('hashSessionToken', () => {
  it('is deterministic', () => {
    expect(hashSessionToken('abc')).toBe(hashSessionToken('abc'));
  });

  it('produces a 64-char hex SHA-256 digest', () => {
    const digest = hashSessionToken('abc');
    expect(digest).toMatch(/^[0-9a-f]{64}$/);
  });

  it('differs for distinct inputs', () => {
    expect(hashSessionToken('abc')).not.toBe(hashSessionToken('abd'));
  });
});
