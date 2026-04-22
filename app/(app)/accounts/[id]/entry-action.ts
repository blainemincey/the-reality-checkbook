'use server';

import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/db/client';
import { payees, transactions } from '@/db/schema';
import { requireAuth } from '@/lib/auth/guards';
import { getAccount } from '@/server/accounts';
import { Cash, parseCashInput } from '@/money';

export type TxnKind =
  | 'deposit'
  | 'payment'
  | 'bill_pay'
  | 'check'
  | 'atm'
  | 'interest'
  | 'dividend'
  | 'transfer'
  | 'tax_payment'
  | 'fee'
  | 'refund'
  | 'other';

export interface EntryInput {
  readonly txnDate: string; // YYYY-MM-DD
  readonly payeeName: string;
  readonly payeeId: string | null;
  readonly kind: TxnKind | null;
  readonly depositAmount: string; // raw user input, may be empty
  readonly paymentAmount: string; // raw user input, may be empty
  readonly memo: string;
  readonly checkNumber: string;
  readonly cleared: boolean;
}

export interface EntryResult {
  ok: boolean;
  error?: string;
  inserted?: {
    id: string;
    amount: string;
    payeeName: string;
  };
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_PAYEE = 80;

function normalizePayee(s: string): string {
  return s.trim().replace(/\s+/g, ' ');
}

export async function createTransactionAction(
  accountId: string,
  input: EntryInput,
): Promise<EntryResult> {
  const { user } = await requireAuth();

  const account = await getAccount(user.id, accountId);
  if (!account) return { ok: false, error: 'Account not found' };

  if (!ISO_DATE.test(input.txnDate)) return { ok: false, error: 'Invalid date' };
  if (input.txnDate < account.openingDate) {
    return {
      ok: false,
      error: `Date must be on or after opening_date ${account.openingDate}`,
    };
  }

  // Exactly one of deposit / payment must carry a value.
  const depRaw = input.depositAmount.trim();
  const payRaw = input.paymentAmount.trim();
  if (!depRaw && !payRaw) {
    return { ok: false, error: 'Enter a deposit or payment amount' };
  }
  if (depRaw && payRaw) {
    return { ok: false, error: 'Enter either a deposit or a payment, not both' };
  }
  const isDeposit = Boolean(depRaw);
  const parsed = parseCashInput(isDeposit ? depRaw : payRaw);
  if (!parsed.ok || !parsed.value) {
    return { ok: false, error: parsed.error ?? 'Invalid amount' };
  }
  const magnitude = parsed.value.abs();
  if (magnitude.isZero()) {
    return { ok: false, error: 'Amount must be non-zero' };
  }
  const signedAmount: Cash = isDeposit ? magnitude : magnitude.neg();

  // Resolve or create the payee.
  const payeeNameInput = normalizePayee(input.payeeName);
  let payeeId: string | null = input.payeeId;
  let payeeNameFinal = payeeNameInput;

  if (payeeNameInput) {
    if (payeeNameInput.length > MAX_PAYEE) {
      return { ok: false, error: `Payee too long (max ${MAX_PAYEE} chars)` };
    }
    if (payeeId) {
      // Trust the id but verify ownership + name match isn't stale.
      const [existing] = await db
        .select()
        .from(payees)
        .where(and(eq(payees.id, payeeId), eq(payees.userId, user.id)));
      if (!existing) {
        payeeId = null; // fall through to create
      } else {
        payeeNameFinal = existing.name;
      }
    }
    if (!payeeId) {
      // Case-insensitive lookup first, create if miss.
      const existing = await db
        .select()
        .from(payees)
        .where(and(eq(payees.userId, user.id), eq(payees.name, payeeNameInput)));
      if (existing.length > 0) {
        payeeId = existing[0]!.id;
        payeeNameFinal = existing[0]!.name;
      } else {
        const [created] = await db
          .insert(payees)
          .values({ userId: user.id, name: payeeNameInput })
          .returning({ id: payees.id, name: payees.name });
        payeeId = created!.id;
        payeeNameFinal = created!.name;
      }
    }
  } else {
    payeeId = null;
    payeeNameFinal = '';
  }

  const kind: TxnKind = input.kind ?? (isDeposit ? 'deposit' : 'payment');

  const [inserted] = await db
    .insert(transactions)
    .values({
      accountId: account.id,
      txnDate: input.txnDate,
      payee: payeeNameFinal || null,
      payeeId,
      kind,
      memo: input.memo.trim() || null,
      checkNumber: input.checkNumber.trim() || null,
      amount: signedAmount.toString(),
      clearedState: input.cleared ? 'cleared' : 'uncleared',
      isBackfill: false,
    })
    .returning({ id: transactions.id, amount: transactions.amount });

  revalidatePath('/');
  revalidatePath(`/accounts/${account.id}`);

  return {
    ok: true,
    inserted: {
      id: inserted!.id,
      amount: inserted!.amount,
      payeeName: payeeNameFinal,
    },
  };
}
