'use server';

import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/db/client';
import { accounts, payees, transactions } from '@/db/schema';
import { Cash, parseCashInput } from '@/money';
import { requireAuth } from '@/lib/auth/guards';
import type { TxnKind } from './entry-action';

type ClearedState = 'uncleared' | 'cleared' | 'reconciled';

async function loadOwnedTxn(
  userId: string,
  txnId: string,
): Promise<typeof transactions.$inferSelect | null> {
  const rows = await db
    .select()
    .from(transactions)
    .innerJoin(accounts, eq(accounts.id, transactions.accountId))
    .where(and(eq(transactions.id, txnId), eq(accounts.userId, userId)));
  return rows[0]?.transactions ?? null;
}

function revalidateForTxn(accountId: string): void {
  revalidatePath('/');
  revalidatePath(`/accounts/${accountId}`);
}

// ---------------------------------------------------------------------------
// Cycle cleared state: uncleared → cleared → reconciled → uncleared
// ---------------------------------------------------------------------------

export interface CycleClearedResult {
  ok: boolean;
  newState?: ClearedState;
  error?: string;
}

export async function cycleClearedStateAction(txnId: string): Promise<CycleClearedResult> {
  const { user } = await requireAuth();
  const current = await loadOwnedTxn(user.id, txnId);
  if (!current) return { ok: false, error: 'Transaction not found' };

  const next: ClearedState =
    current.clearedState === 'uncleared'
      ? 'cleared'
      : current.clearedState === 'cleared'
        ? 'reconciled'
        : 'uncleared';

  await db.update(transactions).set({ clearedState: next }).where(eq(transactions.id, txnId));
  revalidateForTxn(current.accountId);
  return { ok: true, newState: next };
}

export async function setClearedStateAction(
  txnId: string,
  state: ClearedState,
): Promise<CycleClearedResult> {
  const { user } = await requireAuth();
  const current = await loadOwnedTxn(user.id, txnId);
  if (!current) return { ok: false, error: 'Transaction not found' };
  await db.update(transactions).set({ clearedState: state }).where(eq(transactions.id, txnId));
  revalidateForTxn(current.accountId);
  return { ok: true, newState: state };
}

// ---------------------------------------------------------------------------
// Update transaction — mirrors the create path's resolution logic
// ---------------------------------------------------------------------------

export interface UpdateTxnInput {
  readonly txnDate: string; // YYYY-MM-DD
  readonly payeeName: string;
  readonly payeeId: string | null;
  readonly kind: TxnKind | null;
  readonly depositAmount: string;
  readonly paymentAmount: string;
  readonly memo: string;
  readonly checkNumber: string;
  readonly clearedState: ClearedState;
}

export interface UpdateTxnResult {
  ok: boolean;
  error?: string;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export async function updateTransactionAction(
  txnId: string,
  input: UpdateTxnInput,
): Promise<UpdateTxnResult> {
  const { user } = await requireAuth();
  const current = await loadOwnedTxn(user.id, txnId);
  if (!current) return { ok: false, error: 'Transaction not found' };

  const [account] = await db
    .select()
    .from(accounts)
    .where(eq(accounts.id, current.accountId));
  if (!account) return { ok: false, error: 'Account not found' };

  if (!ISO_DATE.test(input.txnDate)) return { ok: false, error: 'Invalid date' };
  if (input.txnDate < account.openingDate) {
    return {
      ok: false,
      error: `Date must be on or after opening_date ${account.openingDate}`,
    };
  }

  const depRaw = input.depositAmount.trim();
  const payRaw = input.paymentAmount.trim();
  if (!depRaw && !payRaw) return { ok: false, error: 'Enter a deposit or payment' };
  if (depRaw && payRaw) {
    return { ok: false, error: 'Enter only a deposit OR a payment, not both' };
  }
  const isDeposit = Boolean(depRaw);
  const parsed = parseCashInput(isDeposit ? depRaw : payRaw);
  if (!parsed.ok || !parsed.value) return { ok: false, error: parsed.error ?? 'Invalid amount' };
  const magnitude = parsed.value.abs();
  if (magnitude.isZero()) return { ok: false, error: 'Amount must be non-zero' };
  const signedAmount: Cash = isDeposit ? magnitude : magnitude.neg();

  // Resolve payee id: trust if provided + owned; else match by name; else create.
  const payeeNameInput = input.payeeName.trim().replace(/\s+/g, ' ');
  let payeeId: string | null = input.payeeId;
  let payeeNameFinal = payeeNameInput;

  if (payeeNameInput) {
    if (payeeId) {
      const [p] = await db
        .select()
        .from(payees)
        .where(and(eq(payees.id, payeeId), eq(payees.userId, user.id)));
      if (!p) payeeId = null;
      else payeeNameFinal = p.name;
    }
    if (!payeeId) {
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

  await db
    .update(transactions)
    .set({
      txnDate: input.txnDate,
      payee: payeeNameFinal || null,
      payeeId,
      kind,
      memo: input.memo.trim() || null,
      checkNumber: input.checkNumber.trim() || null,
      amount: signedAmount.toString(),
      clearedState: input.clearedState,
    })
    .where(eq(transactions.id, txnId));

  revalidateForTxn(account.id);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Soft delete
// ---------------------------------------------------------------------------

export async function deleteTransactionAction(txnId: string): Promise<UpdateTxnResult> {
  const { user } = await requireAuth();
  const current = await loadOwnedTxn(user.id, txnId);
  if (!current) return { ok: false, error: 'Transaction not found' };
  await db
    .update(transactions)
    .set({ isDeleted: true })
    .where(eq(transactions.id, txnId));
  revalidateForTxn(current.accountId);
  return { ok: true };
}
