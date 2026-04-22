// Create the first (or an additional) user. Reads email + password from:
//   --email and --password CLI flags, OR
//   INIT_EMAIL / INIT_PASSWORD env vars, OR
//   interactive prompt.
//
// Usage:
//   npm run create-user                               # interactive
//   npm run create-user -- --email me@x.com          # prompt for password only
//   INIT_EMAIL=... INIT_PASSWORD=... npm run create-user
//
// Requires DATABASE_URL. Migrations must already be applied.

import { createInterface } from 'node:readline/promises';
import { stdin, stdout, exit, env, argv } from 'node:process';
import { eq } from 'drizzle-orm';
import { db } from '../src/db/client';
import { users } from '../src/db/schema';
import { hashPassword, PasswordError } from '../src/lib/auth/password';

function parseFlags(args: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0; i < args.length; i++) {
    const flag = args[i];
    if (flag?.startsWith('--')) {
      const key = flag.slice(2);
      const value = args[i + 1];
      if (value !== undefined && !value.startsWith('--')) {
        out[key] = value;
        i++;
      } else {
        out[key] = '';
      }
    }
  }
  return out;
}

async function promptPassword(rl: ReturnType<typeof createInterface>): Promise<string> {
  // Minimal: readline#question can't easily mask input in all terminals.
  // Accept plain-text for a local CLI; document that for scripted prod use,
  // pass INIT_PASSWORD via env.
  return (await rl.question('Password (min 8 chars): ')).trim();
}

async function main(): Promise<void> {
  const flags = parseFlags(argv.slice(2));

  let email = flags['email'] ?? env['INIT_EMAIL'] ?? '';
  let password = flags['password'] ?? env['INIT_PASSWORD'] ?? '';

  const rl = createInterface({ input: stdin, output: stdout });
  try {
    if (!email) {
      email = (await rl.question('Email: ')).trim();
    }
    if (!password) {
      password = await promptPassword(rl);
    }
  } finally {
    rl.close();
  }

  email = email.toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    console.error(`Invalid email: "${email}"`);
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
    console.error(`User already exists: ${email}`);
    exit(1);
  }

  const [inserted] = await db
    .insert(users)
    .values({ email, passwordHash })
    .returning({ id: users.id, email: users.email });

  console.log(`Created user ${inserted!.email} (id ${inserted!.id})`);
  exit(0);
}

main().catch((err) => {
  console.error(err);
  exit(1);
});
