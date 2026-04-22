'use server';

import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/db/client';
import { accounts, transactions } from '@/db/schema';
import { Cash, parseCashInput } from '@/money';
import { requireAuth } from '@/lib/auth/guards';

export interface UpdateAccountState {
  error?: string;
  fieldErrors?: Partial<
    Record<'name' | 'openingBalance' | 'openingDate' | 'institution' | 'last4', string>
  >;
  success?: string;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export async function updateAccountAction(
  accountId: string,
  _prev: UpdateAccountState,
  formData: FormData,
): Promise<UpdateAccountState> {
  const { user } = await requireAuth();

  const [current] = await db
    .select()
    .from(accounts)
    .where(and(eq(accounts.id, accountId), eq(accounts.userId, user.id)));
  if (!current) return { error: 'Account not found' };

  const name = String(formData.get('name') ?? '').trim();
  const openingBalanceRaw = String(formData.get('openingBalance') ?? '').trim();
  const openingDate = String(formData.get('openingDate') ?? '').trim();
  const institution = String(formData.get('institution') ?? '').trim() || null;
  const last4Raw = String(formData.get('last4') ?? '').trim();

  const fieldErrors: UpdateAccountState['fieldErrors'] = {};
  if (!name) fieldErrors.name = 'Required';
  if (!ISO_DATE.test(openingDate)) fieldErrors.openingDate = 'Use YYYY-MM-DD';

  let openingBalance: Cash | null = null;
  if (!openingBalanceRaw) {
    fieldErrors.openingBalance = 'Required';
  } else {
    const parsed = parseCashInput(openingBalanceRaw);
    if (!parsed.ok || !parsed.value) {
      fieldErrors.openingBalance = parsed.error ?? 'Invalid amount';
    } else {
      openingBalance = parsed.value;
    }
  }

  const last4 = last4Raw && /^\d{4}$/.test(last4Raw) ? last4Raw : null;
  if (last4Raw && !last4) fieldErrors.last4 = 'Must be 4 digits';

  if (Object.keys(fieldErrors).length > 0 || !openingBalance) {
    return { fieldErrors };
  }

  // Moving opening_date forward past existing transactions would orphan them
  // from the register. Refuse rather than silently drop rows.
  if (openingDate !== current.openingDate) {
    const [blocking] = await db
      .select({ id: transactions.id, txnDate: transactions.txnDate })
      .from(transactions)
      .where(
        and(
          eq(transactions.accountId, current.id),
          eq(transactions.isDeleted, false),
        ),
      )
      .orderBy(transactions.txnDate);
    if (blocking && blocking.txnDate < openingDate) {
      return {
        error: `Cannot move opening_date to ${openingDate} — there is a transaction dated ${blocking.txnDate} that would fall before it. Edit or delete earlier transactions first.`,
      };
    }
  }

  await db
    .update(accounts)
    .set({
      name,
      openingBalance: openingBalance.toString(),
      openingDate,
      institution,
      last4,
    })
    .where(eq(accounts.id, accountId));

  revalidatePath('/');
  revalidatePath(`/accounts/${accountId}`);
  revalidatePath(`/accounts/${accountId}/settings`);

  return { success: 'Saved.' };
}
