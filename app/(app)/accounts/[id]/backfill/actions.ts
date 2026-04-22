'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { db } from '@/db/client';
import { transactions } from '@/db/schema';
import { requireAuth } from '@/lib/auth/guards';
import { getAccount } from '@/server/accounts';
import { Cash } from '@/money';

export interface CommitRow {
  txnDate: string;
  payee: string | null;
  amount: string; // fixed-scale string (Cash.toString())
  memo: string | null;
  checkNumber: string | null;
  cleared: boolean;
}

export interface CommitResult {
  ok: boolean;
  error?: string;
  inserted?: number;
}

export async function commitBackfillAction(
  accountId: string,
  rows: CommitRow[],
): Promise<CommitResult> {
  const { user } = await requireAuth();

  const account = await getAccount(user.id, accountId);
  if (!account) return { ok: false, error: 'Account not found' };

  if (!Array.isArray(rows) || rows.length === 0) {
    return { ok: false, error: 'Nothing to commit' };
  }
  if (rows.length > 5000) {
    return { ok: false, error: 'Too many rows in a single commit (limit 5000)' };
  }

  // Validate server-side that every row parses as Cash and every date is after opening_date.
  const values: (typeof transactions.$inferInsert)[] = [];
  for (const [i, r] of rows.entries()) {
    if (typeof r.txnDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(r.txnDate)) {
      return { ok: false, error: `Row ${i + 1}: invalid date "${r.txnDate}"` };
    }
    if (r.txnDate < account.openingDate) {
      return {
        ok: false,
        error: `Row ${i + 1}: date ${r.txnDate} is before account opening ${account.openingDate}`,
      };
    }
    let amount: Cash;
    try {
      amount = Cash.of(r.amount);
    } catch {
      return { ok: false, error: `Row ${i + 1}: invalid amount "${r.amount}"` };
    }

    values.push({
      accountId: account.id,
      txnDate: r.txnDate,
      payee: r.payee?.trim() || null,
      memo: r.memo?.trim() || null,
      checkNumber: r.checkNumber?.trim() || null,
      amount: amount.toString(),
      clearedState: r.cleared ? 'cleared' : 'uncleared',
      isBackfill: true,
    });
  }

  await db.insert(transactions).values(values);

  revalidatePath('/');
  revalidatePath(`/accounts/${account.id}`);

  return { ok: true, inserted: values.length };
}

export async function commitAndReturn(
  accountId: string,
  rows: CommitRow[],
): Promise<never> {
  const result = await commitBackfillAction(accountId, rows);
  if (!result.ok) {
    // Form-action callers catch via throw; the client path uses commitBackfillAction directly.
    throw new Error(result.error ?? 'Commit failed');
  }
  redirect(`/accounts/${accountId}`);
}
