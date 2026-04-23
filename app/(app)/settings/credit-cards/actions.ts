'use server';

import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/db/client';
import { creditCards } from '@/db/schema';
import { requireAuth } from '@/lib/auth/guards';
import { parseCashInput } from '@/money';

export interface CreditCardActionState {
  error?: string;
  success?: string;
}

const MAX_NAME = 80;
const MAX_INSTITUTION = 80;

function revalidateViews() {
  revalidatePath('/settings/credit-cards');
  revalidatePath('/');
}

export async function createCreditCardAction(
  _prev: CreditCardActionState,
  formData: FormData,
): Promise<CreditCardActionState> {
  const { user } = await requireAuth();

  const name = String(formData.get('name') ?? '').trim();
  const institution = String(formData.get('institution') ?? '').trim() || null;
  const last4Raw = String(formData.get('last4') ?? '').trim();
  const amountRaw = String(formData.get('amountOwed') ?? '').trim();

  if (!name) return { error: 'Name is required' };
  if (name.length > MAX_NAME) return { error: `Name too long (max ${MAX_NAME})` };
  if (institution && institution.length > MAX_INSTITUTION)
    return { error: `Institution too long (max ${MAX_INSTITUTION})` };

  const last4 = last4Raw && /^\d{4}$/.test(last4Raw) ? last4Raw : null;
  if (last4Raw && !last4) return { error: 'Last 4 must be 4 digits' };

  let amount = '0';
  if (amountRaw) {
    const parsed = parseCashInput(amountRaw);
    if (!parsed.ok || !parsed.value)
      return { error: parsed.error ?? 'Invalid amount' };
    amount = parsed.value.toString();
  }

  await db.insert(creditCards).values({
    userId: user.id,
    name,
    institution,
    last4,
    amountOwed: amount,
  });

  revalidateViews();
  return { success: `Added ${name}` };
}

export async function updateCreditCardAmountAction(
  cardId: string,
  amountRaw: string,
): Promise<CreditCardActionState> {
  const { user } = await requireAuth();

  const parsed = parseCashInput(amountRaw);
  if (!parsed.ok || !parsed.value) return { error: parsed.error ?? 'Invalid amount' };

  const [updated] = await db
    .update(creditCards)
    .set({ amountOwed: parsed.value.toString(), lastUpdatedAt: new Date() })
    .where(and(eq(creditCards.id, cardId), eq(creditCards.userId, user.id)))
    .returning({ id: creditCards.id });

  if (!updated) return { error: 'Card not found' };

  revalidateViews();
  return { success: 'Updated' };
}

export async function updateCreditCardIdentityAction(
  cardId: string,
  patch: { name?: string; institution?: string; last4?: string },
): Promise<CreditCardActionState> {
  const { user } = await requireAuth();

  const updates: { name?: string; institution?: string | null; last4?: string | null } = {};
  if (patch.name !== undefined) {
    const name = patch.name.trim();
    if (!name) return { error: 'Name is required' };
    if (name.length > MAX_NAME) return { error: `Name too long (max ${MAX_NAME})` };
    updates.name = name;
  }
  if (patch.institution !== undefined) {
    const inst = patch.institution.trim();
    if (inst.length > MAX_INSTITUTION)
      return { error: `Institution too long (max ${MAX_INSTITUTION})` };
    updates.institution = inst || null;
  }
  if (patch.last4 !== undefined) {
    const raw = patch.last4.trim();
    if (raw && !/^\d{4}$/.test(raw)) return { error: 'Last 4 must be 4 digits' };
    updates.last4 = raw || null;
  }

  await db
    .update(creditCards)
    .set(updates)
    .where(and(eq(creditCards.id, cardId), eq(creditCards.userId, user.id)));

  revalidateViews();
  return { success: 'Saved' };
}

export async function archiveCreditCardAction(
  cardId: string,
): Promise<CreditCardActionState> {
  const { user } = await requireAuth();
  await db
    .update(creditCards)
    .set({ isArchived: true })
    .where(and(eq(creditCards.id, cardId), eq(creditCards.userId, user.id)));
  revalidateViews();
  return { success: 'Archived' };
}

export async function restoreCreditCardAction(
  cardId: string,
): Promise<CreditCardActionState> {
  const { user } = await requireAuth();
  await db
    .update(creditCards)
    .set({ isArchived: false })
    .where(and(eq(creditCards.id, cardId), eq(creditCards.userId, user.id)));
  revalidateViews();
  return { success: 'Restored' };
}

export async function deleteCreditCardAction(
  cardId: string,
): Promise<CreditCardActionState> {
  const { user } = await requireAuth();
  await db
    .delete(creditCards)
    .where(and(eq(creditCards.id, cardId), eq(creditCards.userId, user.id)));
  revalidateViews();
  return { success: 'Deleted' };
}
