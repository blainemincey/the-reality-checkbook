'use server';

import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/db/client';
import { payees } from '@/db/schema';
import { requireAuth } from '@/lib/auth/guards';

export interface PayeeActionState {
  error?: string;
  success?: string;
}

const MAX_NAME = 80;

function normalizeName(raw: string): string | null {
  const trimmed = raw.trim().replace(/\s+/g, ' ');
  if (!trimmed) return null;
  if (trimmed.length > MAX_NAME) return null;
  return trimmed;
}

export async function createPayeeAction(
  _prev: PayeeActionState,
  formData: FormData,
): Promise<PayeeActionState> {
  const { user } = await requireAuth();
  const name = normalizeName(String(formData.get('name') ?? ''));
  if (!name) return { error: 'Name is required (max 80 chars)' };

  try {
    await db.insert(payees).values({ userId: user.id, name });
  } catch (e) {
    if ((e as { code?: string }).code === '23505') {
      return { error: `"${name}" is already a payee.` };
    }
    throw e;
  }

  revalidatePath('/settings/payees');
  return { success: `Added ${name}` };
}

export async function renamePayeeAction(
  payeeId: string,
  formData: FormData,
): Promise<PayeeActionState> {
  const { user } = await requireAuth();
  const name = normalizeName(String(formData.get('name') ?? ''));
  if (!name) return { error: 'Name is required' };

  try {
    const result = await db
      .update(payees)
      .set({ name })
      .where(and(eq(payees.id, payeeId), eq(payees.userId, user.id)))
      .returning({ id: payees.id });
    if (result.length === 0) return { error: 'Payee not found' };
  } catch (e) {
    if ((e as { code?: string }).code === '23505') {
      return { error: `"${name}" is already a payee.` };
    }
    throw e;
  }

  revalidatePath('/settings/payees');
  return { success: 'Renamed' };
}

export async function archivePayeeAction(payeeId: string): Promise<PayeeActionState> {
  const { user } = await requireAuth();
  await db
    .update(payees)
    .set({ isArchived: true })
    .where(and(eq(payees.id, payeeId), eq(payees.userId, user.id)));
  revalidatePath('/settings/payees');
  return { success: 'Archived' };
}

export async function restorePayeeAction(payeeId: string): Promise<PayeeActionState> {
  const { user } = await requireAuth();
  await db
    .update(payees)
    .set({ isArchived: false })
    .where(and(eq(payees.id, payeeId), eq(payees.userId, user.id)));
  revalidatePath('/settings/payees');
  return { success: 'Restored' };
}

export async function deletePayeeAction(payeeId: string): Promise<PayeeActionState> {
  const { user } = await requireAuth();
  await db
    .delete(payees)
    .where(and(eq(payees.id, payeeId), eq(payees.userId, user.id)));
  revalidatePath('/settings/payees');
  return { success: 'Deleted' };
}
