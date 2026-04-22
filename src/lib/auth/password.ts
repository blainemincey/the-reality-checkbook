import argon2 from '@node-rs/argon2';

// OWASP 2024 recommendation for Argon2id: m=19 MiB, t=2, p=1.
// https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html
const HASH_OPTIONS = {
  memoryCost: 19456,
  timeCost: 2,
  outputLen: 32,
  parallelism: 1,
} as const;

const MIN_LENGTH = 8;
const MAX_LENGTH = 256;

export class PasswordError extends Error {}

export async function hashPassword(plain: string): Promise<string> {
  if (typeof plain !== 'string') throw new PasswordError('password must be a string');
  if (plain.length < MIN_LENGTH)
    throw new PasswordError(`password must be at least ${MIN_LENGTH} characters`);
  if (plain.length > MAX_LENGTH)
    throw new PasswordError(`password must be at most ${MAX_LENGTH} characters`);
  return argon2.hash(plain, HASH_OPTIONS);
}

export async function verifyPassword(hash: string, plain: string): Promise<boolean> {
  if (typeof hash !== 'string' || typeof plain !== 'string') return false;
  try {
    return await argon2.verify(hash, plain);
  } catch {
    return false;
  }
}
