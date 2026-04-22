'use server';

import { redirect } from 'next/navigation';
import { db } from '@/db/client';
import { accounts } from '@/db/schema';
import { Cash, parseCashInput } from '@/money';
import { requireAuth } from '@/lib/auth/guards';

export interface CreateAccountState {
  error?: string;
  fieldErrors?: Partial<Record<'name' | 'accountType' | 'openingBalance' | 'openingDate', string>>;
}

const ACCOUNT_TYPES = [
  'checking',
  'savings',
  'credit_card',
  'cash',
  'brokerage',
  'retirement',
] as const;
type AccountType = (typeof ACCOUNT_TYPES)[number];

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export async function createAccountAction(
  _prev: CreateAccountState,
  formData: FormData,
): Promise<CreateAccountState> {
  const { user } = await requireAuth();

  const name = String(formData.get('name') ?? '').trim();
  const accountType = String(formData.get('accountType') ?? '') as AccountType;
  const openingBalanceRaw = String(formData.get('openingBalance') ?? '').trim();
  const openingDate = String(formData.get('openingDate') ?? '').trim();
  const institution = String(formData.get('institution') ?? '').trim() || null;
  const last4Raw = String(formData.get('last4') ?? '').trim();

  const fieldErrors: CreateAccountState['fieldErrors'] = {};
  if (!name) fieldErrors.name = 'Required';
  if (!ACCOUNT_TYPES.includes(accountType)) fieldErrors.accountType = 'Select a type';
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
  if (last4Raw && !last4) {
    fieldErrors.name = (fieldErrors.name ?? '') + (fieldErrors.name ? ' ' : '');
    return { fieldErrors: { ...fieldErrors, name: 'Last 4 must be 4 digits' } };
  }

  if (Object.keys(fieldErrors).length > 0 || !openingBalance) {
    return { fieldErrors };
  }

  const [inserted] = await db
    .insert(accounts)
    .values({
      userId: user.id,
      name,
      accountType,
      currency: 'USD',
      openingBalance: openingBalance.toString(),
      openingDate,
      institution,
      last4,
    })
    .returning({ id: accounts.id });

  redirect(`/accounts/${inserted!.id}/backfill`);
}
