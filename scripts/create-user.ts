// Create or promote a user. Reads credentials from:
//   --username / --password CLI flags, OR
//   INIT_USERNAME / INIT_PASSWORD env vars, OR
//   interactive prompt.
//
// Usage:
//   npm run create-user                                      # interactive
//   npm run create-user -- --username taylor                 # prompt for password
//   npm run create-user -- --admin                           # force role=admin
//   npm run create-user -- --promote --username taylor       # flip existing user to admin
//   INIT_USERNAME=... INIT_PASSWORD=... npm run create-user
//
// Role semantics:
//   - The very first user (empty users table) is always created as 'admin'.
//   - Otherwise the role is 'user' unless --admin or --role=admin is passed.
//   - --promote updates an existing user's role without needing password.
//
// Requires DATABASE_URL (loaded from .env automatically). Migrations must
// already be applied.

import 'dotenv/config';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout, exit, env, argv } from 'node:process';
import { eq, sql } from 'drizzle-orm';
import { db } from '../src/db/client';
import { users } from '../src/db/schema';
import { hashPassword, PasswordError } from '../src/lib/auth/password';
import { isValidUsername, normalizeUsername } from '../src/lib/username';

type Role = 'admin' | 'user';

interface Flags {
  username?: string;
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
      case 'username':
        if (hasValue) { out.username = next; i++; }
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
  const raw = flags.username ?? env['INIT_USERNAME'] ?? '';
  const username = normalizeUsername(raw);
  if (!isValidUsername(username)) {
    console.error('--promote requires a valid --username');
    exit(2);
  }
  const targetRole: Role = flags.role ?? 'admin';

  const [updated] = await db
    .update(users)
    .set({ role: targetRole })
    .where(eq(users.username, username))
    .returning({ id: users.id, username: users.username, role: users.role });

  if (!updated) {
    console.error(`No user found: ${username}`);
    exit(1);
  }
  console.log(`Set ${updated.username} role = ${updated.role}`);
  exit(0);
}

async function createUser(flags: Flags): Promise<void> {
  let usernameRaw = flags.username ?? env['INIT_USERNAME'] ?? '';
  let password = flags.password ?? env['INIT_PASSWORD'] ?? '';

  const rl = createInterface({ input: stdin, output: stdout });
  try {
    if (!usernameRaw) usernameRaw = await promptLine('Username: ', rl);
    if (!password) password = await promptLine('Password (min 8 chars): ', rl);
  } finally {
    rl.close();
  }

  const username = normalizeUsername(usernameRaw);
  if (!isValidUsername(username)) {
    console.error(
      `Invalid username: "${usernameRaw}". Use 3–32 chars: lowercase letters, digits, . _ - ; must start/end with a letter or digit.`,
    );
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

  const existing = await db.select().from(users).where(eq(users.username, username));
  if (existing.length > 0) {
    console.error(
      `User already exists: ${username}\n` +
        `To change an existing user's role, run:\n` +
        `  npm run create-user -- --promote --username ${username}`,
    );
    exit(1);
  }

  const [count] = await db.select({ n: sql<number>`count(*)::int` }).from(users);
  const isFirstUser = (count?.n ?? 0) === 0;

  const role: Role = isFirstUser
    ? 'admin'
    : flags.role ?? (flags.admin ? 'admin' : 'user');

  const [inserted] = await db
    .insert(users)
    .values({ username, passwordHash, role })
    .returning({ id: users.id, username: users.username, role: users.role });

  console.log(
    `Created user ${inserted!.username} (id ${inserted!.id}, role ${inserted!.role}${isFirstUser ? ' — first user, auto-admin' : ''})`,
  );
  exit(0);
}

main().catch((err) => {
  console.error(err);
  exit(1);
});
