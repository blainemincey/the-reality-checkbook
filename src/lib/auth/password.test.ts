import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword, PasswordError } from './password';

describe('hashPassword / verifyPassword', () => {
  it('round-trips a correct password', async () => {
    const hash = await hashPassword('hunter2-is-a-real-password');
    expect(hash).toMatch(/^\$argon2id\$/);
    expect(await verifyPassword(hash, 'hunter2-is-a-real-password')).toBe(true);
  });

  it('rejects an incorrect password', async () => {
    const hash = await hashPassword('hunter2-is-a-real-password');
    expect(await verifyPassword(hash, 'not-it')).toBe(false);
  });

  it('produces distinct hashes for the same password (random salt)', async () => {
    const a = await hashPassword('same-input-both-times');
    const b = await hashPassword('same-input-both-times');
    expect(a).not.toBe(b);
    expect(await verifyPassword(a, 'same-input-both-times')).toBe(true);
    expect(await verifyPassword(b, 'same-input-both-times')).toBe(true);
  });

  it('rejects short passwords at hash time', async () => {
    await expect(hashPassword('short')).rejects.toBeInstanceOf(PasswordError);
  });

  it('rejects excessively long passwords', async () => {
    await expect(hashPassword('x'.repeat(300))).rejects.toBeInstanceOf(PasswordError);
  });

  it('verifyPassword returns false on malformed hash (no throw)', async () => {
    expect(await verifyPassword('not-a-valid-hash', 'whatever')).toBe(false);
    expect(await verifyPassword('', 'whatever')).toBe(false);
  });
}, 20_000);
