import { and, eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { accounts, transactions, type AccountRow } from '@/db/schema';
import { Cash } from '@/money';
import { balanceAsOf } from '@/domain/accounts';
import { balanceTimeSeries, type BalancePoint } from '@/domain/charts';

export type AccountWithBalance = AccountRow & {
  currentBalance: Cash;
  series: readonly BalancePoint[];
};

export async function listAccountsForUser(userId: string): Promise<AccountWithBalance[]> {
  const rows = await db
    .select()
    .from(accounts)
    .where(and(eq(accounts.userId, userId), eq(accounts.isArchived, false)))
    .orderBy(accounts.createdAt);

  const today = isoToday();
  const withBalance: AccountWithBalance[] = [];
  for (const row of rows) {
    const txns = await db
      .select()
      .from(transactions)
      .where(and(eq(transactions.accountId, row.id), eq(transactions.isDeleted, false)));

    const ledger = txns.map((t) => ({
      id: t.id,
      txnDate: t.txnDate,
      amount: Cash.of(t.amount),
      clearedState: t.clearedState,
    }));
    const opening = {
      openingBalance: Cash.of(row.openingBalance),
      openingDate: row.openingDate,
    };
    const balance = balanceAsOf(opening, ledger, today);
    const series = balanceTimeSeries(opening, ledger, today);

    withBalance.push({ ...row, currentBalance: balance, series });
  }
  return withBalance;
}

export async function getAccount(userId: string, accountId: string): Promise<AccountRow | null> {
  const [row] = await db
    .select()
    .from(accounts)
    .where(and(eq(accounts.id, accountId), eq(accounts.userId, userId)));
  return row ?? null;
}

export function isoToday(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
