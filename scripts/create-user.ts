// Create or promote a user. Reads credentials from:
//   --email / --password CLI flags, OR
//   INIT_EMAIL / INIT_PASSWORD env vars, OR
//   interactive prompt.
//
// Usage:
//   npm run create-user                                  # interactive
//   npm run create-user -- --email me@x.com              # prompt for password
//   npm run create-user -- --admin                       # force role=admin
//   npm run create-user -- --promote --email me@x.com    # flip existing user to admin
//   INIT_EMAIL=... INIT_PASSWORD=... npm run create-user
//
// Role semantics:
//   - The very first user (empty users table) is always created as 'admin'.
//   - Otherwise the role is 'user' unless --admin or --role=admin is passed.
//   - --promote updates an existing user's role without needing password.
//
// Requires DATABASE_URL (loaded from .env automatically below). Migrations
// must already be applied.

import 'dotenv/config';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout, exit, env, argv } from 'node:process';
import { eq, sql } from 'drizzle-orm';
import { db } from '../src/db/client';
import { users } from '../src/db/schema';
import { hashPassword, PasswordError } from '../src/lib/auth/password';

type Role = 'admin' | 'user';

interface Flags {
  email?: string;
  password?: string;
  admin?: boolean;
  role?: Role;
  promote?: boolean;
}

function parseFlags(args: string[]): Flags {
  const out: Flags = {};
  for (let i = 0; i < args.length; i++) {
    const flag = args[i];
    if (!flag?.startsWith('--')) continue;
    const key = flag.slice(2);
    const next = args[i + 1];
    const hasValue = next !== undefined && !next.startsWith('--');
    switch (key) {
      case 'email':
        if (hasValue) { out.email = next; i++; }
        break;
      case 'password':
        if (hasValue) { out.password = next; i++; }
        break;
      case 'admin':
        out.admin = true;
        break;
      case 'role':
        if (hasValue && (next === 'admin' || next === 'user')) { out.role = next as Role; i++; }
        break;
      case 'promote':
        out.promote = true;
        break;
    }
  }
  return out;
}

function normalizeEmail(raw: string): string | null {
  const e = raw.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) return null;
  return e;
}

async function promptLine(prompt: string, rl: ReturnType<typeof createInterface>): Promise<string> {
  return (await rl.question(prompt)).trim();
}

async function main(): Promise<void> {
  const flags = parseFlags(argv.slice(2));

  if (flags.promote) {
    await promoteUser(flags);
    return;
  }

  await createUser(flags);
}

async function promoteUser(flags: Flags): Promise<void> {
  const emailRaw = flags.email ?? env['INIT_EMAIL'] ?? '';
  const email = normalizeEmail(emailRaw);
  if (!email) {
    console.error('--promote requires --email <valid address>');
    exit(2);
  }
  const targetRole: Role = flags.role ?? 'admin';

  const [updated] = await db
    .update(users)
    .set({ role: targetRole })
    .where(eq(users.email, email))
    .returning({ id: users.id, email: users.email, role: users.role });

  if (!updated) {
    console.error(`No user found with email ${email}`);
    exit(1);
  }
  console.log(`Set ${updated.email} role = ${updated.role}`);
  exit(0);
}

async function createUser(flags: Flags): Promise<void> {
  let emailRaw = flags.email ?? env['INIT_EMAIL'] ?? '';
  let password = flags.password ?? env['INIT_PASSWORD'] ?? '';

  const rl = createInterface({ input: stdin, output: stdout });
  try {
    if (!emailRaw) emailRaw = await promptLine('Email: ', rl);
    if (!password) password = await promptLine('Password (min 8 chars): ', rl);
  } finally {
    rl.close();
  }

  const email = normalizeEmail(emailRaw);
  if (!email) {
    console.error(`Invalid email: "${emailRaw}"`);
    exit(2);
  }

  let passwordHash: string;
  try {
    passwordHash = await hashPassword(password);
  } catch (err) {
    if (err instanceof PasswordError) {
      console.error(err.message);
      exit(2);
    }
    throw err;
  }

  const existing = await db.select().from(users).where(eq(users.email, email));
  if (existing.length > 0) {
    console.error(
      `User already exists: ${email}\n` +
        `To change an existing user's role, run:\n` +
        `  npm run create-user -- --promote --email ${email}`,
    );
    exit(1);
  }

  // First user in the system is always admin.
  const [count] = await db.select({ n: sql<number>`count(*)::int` }).from(users);
  const isFirstUser = (count?.n ?? 0) === 0;

  const role: Role = isFirstUser
    ? 'admin'
    : flags.role ?? (flags.admin ? 'admin' : 'user');

  const [inserted] = await db
    .insert(users)
    .values({ email, passwordHash, role })
    .returning({ id: users.id, email: users.email, role: users.role });

  console.log(
    `Created user ${inserted!.email} (id ${inserted!.id}, role ${inserted!.role}${isFirstUser ? ' — first user, auto-admin' : ''})`,
  );
  exit(0);
}

main().catch((err) => {
  console.error(err);
  exit(1);
});
