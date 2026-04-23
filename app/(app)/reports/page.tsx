import Link from 'next/link';
import { and, eq } from 'drizzle-orm';
import { requireAuth } from '@/lib/auth/guards';
import { db } from '@/db/client';
import { accounts, transactions } from '@/db/schema';
import { isoToday } from '@/server/accounts';
import { ReportsWorkspace } from './reports-workspace';

export default async function ReportsPage() {
  const { user } = await requireAuth();

  const rows = await db
    .select({
      id: transactions.id,
      txnDate: transactions.txnDate,
      amount: transactions.amount,
      clearedState: transactions.clearedState,
      payee: transactions.payee,
      kind: transactions.kind,
    })
    .from(transactions)
    .innerJoin(accounts, eq(accounts.id, transactions.accountId))
    .where(and(eq(accounts.userId, user.id), eq(transactions.isDeleted, false)));

  return (
    <main className="mx-auto max-w-7xl px-6 py-10">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Reports</h1>
        <p className="mt-1.5 max-w-2xl text-sm text-text-secondary">
          Monthly cashflow, top payees, and spending by type. All reports scope
          to the same period selector — change it once, every chart updates.
        </p>
      </header>

      {rows.length === 0 ? (
        <div className="card flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
          <p className="text-sm text-text-secondary">
            No transactions yet — add a few from an{' '}
            <Link href="/" className="text-accent no-underline">
              account
            </Link>{' '}
            and the reports fill in.
          </p>
        </div>
      ) : (
        <ReportsWorkspace transactions={rows} todayIso={isoToday()} />
      )}
    </main>
  );
}
