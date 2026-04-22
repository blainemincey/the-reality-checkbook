'use server';

import { and, eq, ne } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/db/client';
import { users } from '@/db/schema';
import { hashPassword, PasswordError } from '@/lib/auth/password';
import { requireAdmin } from '@/lib/auth/guards';
import { isValidUsername, normalizeUsername } from '@/lib/username';

export interface UserActionState {
  error?: string;
  success?: string;
}

type Role = 'admin' | 'user';

export async function createUserAction(
  _prev: UserActionState,
  formData: FormData,
): Promise<UserActionState> {
  await requireAdmin();

  const username = normalizeUsername(String(formData.get('username') ?? ''));
  const password = String(formData.get('password') ?? '');
  const roleRaw = String(formData.get('role') ?? 'user');
  const role: Role = roleRaw === 'admin' ? 'admin' : 'user';

  if (!isValidUsername(username)) {
    return {
      error:
        'Username must be 3–32 chars: lowercase letters, digits, . _ -; start/end with letter or digit.',
    };
  }

  let passwordHash: string;
  try {
    passwordHash = await hashPassword(password);
  } catch (e) {
    if (e instanceof PasswordError) return { error: e.message };
    throw e;
  }

  try {
    await db.insert(users).values({ username, passwordHash, role });
  } catch (e) {
    if ((e as { code?: string }).code === '23505') {
      return { error: `Username "${username}" already exists.` };
    }
    throw e;
  }

  revalidatePath('/settings/users');
  return { success: `Added ${username}` };
}

export async function updateUserRoleAction(
  targetId: string,
  role: Role,
): Promise<UserActionState> {
  const { user } = await requireAdmin();

  if (role !== 'admin' && role !== 'user') return { error: 'Invalid role' };

  if (targetId === user.id && role !== 'admin') {
    const admins = await db.select({ id: users.id }).from(users).where(eq(users.role, 'admin'));
    if (admins.length <= 1) {
      return { error: "Can't demote yourself — you're the only admin." };
    }
  }

  await db.update(users).set({ role }).where(eq(users.id, targetId));
  revalidatePath('/settings/users');
  return { success: `Role set to ${role}` };
}

export async function resetUserPasswordAction(
  targetId: string,
  formData: FormData,
): Promise<UserActionState> {
  await requireAdmin();
  const password = String(formData.get('password') ?? '');

  let passwordHash: string;
  try {
    passwordHash = await hashPassword(password);
  } catch (e) {
    if (e instanceof PasswordError) return { error: e.message };
    throw e;
  }

  await db.update(users).set({ passwordHash }).where(eq(users.id, targetId));
  revalidatePath('/settings/users');
  return { success: 'Password reset' };
}

export async function deleteUserAction(targetId: string): Promise<UserActionState> {
  const { user } = await requireAdmin();

  if (targetId === user.id) {
    return { error: "You can't delete yourself." };
  }

  const [target] = await db.select().from(users).where(eq(users.id, targetId));
  if (!target) return { error: 'User not found' };
  if (target.role === 'admin') {
    const otherAdmins = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.role, 'admin'), ne(users.id, targetId)));
    if (otherAdmins.length === 0) {
      return { error: "Can't delete the last admin." };
    }
  }

  await db.delete(users).where(eq(users.id, targetId));
  revalidatePath('/settings/users');
  return { success: `Deleted ${target.username}` };
}
