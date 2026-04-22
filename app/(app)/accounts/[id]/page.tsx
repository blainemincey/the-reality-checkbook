import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAuth } from '@/lib/auth/guards';
import { getAccount } from '@/server/accounts';
import { db } from '@/db/client';
import { transactions } from '@/db/schema';
import { and, eq } from 'drizzle-orm';
import { Cash } from '@/money';
import { registerRows } from '@/domain/accounts';
import { Amount } from '@/ui/components/amount';
import { InstitutionBadge } from '@/ui/components/institution-badge';
import { AccountTypeIcon, accountTypeLabel } from '@/ui/components/account-type-icon';
import { formatCash } from '@/money';

export default async function AccountPage({ params }: { params: Promise<{ id: string }> }) {
  const { user } = await requireAuth();
  const { id } = await params;
  const account = await getAccount(user.id, id);
  if (!account) notFound();

  const rows = await db
    .select()
    .from(transactions)
    .where(and(eq(transactions.accountId, account.id), eq(transactions.isDeleted, false)));

  const register = registerRows(
    { openingBalance: Cash.of(account.openingBalance), openingDate: account.openingDate },
    rows.map((r) => ({
      id: r.id,
      txnDate: r.txnDate,
      amount: Cash.of(r.amount),
      clearedState: r.clearedState,
    })),
  );

  const currentBalance =
    register.length > 0 ? register[register.length - 1]!.runningBalance : Cash.of(account.openingBalance);

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <div className="mb-6">
        <Link
          href="/"
          className="text-xs text-text-tertiary transition-colors duration-120 ease-swift hover:text-text-secondary"
        >
          ← Accounts
        </Link>
        <div className="mt-2 flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <InstitutionBadge institution={account.institution} fallback={account.name} size="lg" />
            <div className="min-w-0">
              <h1 className="truncate text-lg font-medium">{account.name}</h1>
              <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-text-tertiary">
                <AccountTypeIcon type={account.accountType} />
                <span>{accountTypeLabel(account.accountType)}</span>
                {account.institution && <span>· {account.institution}</span>}
                {account.last4 && <span>····{account.last4}</span>}
                <span>· opened {account.openingDate} at {formatCash(Cash.of(account.openingBalance))}</span>
              </p>
            </div>
          </div>
          <Amount value={currentBalance} className="text-lg" />
        </div>
        <div className="mt-4 flex items-center gap-3 text-xs">
          <Link
            href={`/accounts/${account.id}/backfill`}
            className="rounded border border-border bg-surface px-2.5 py-1 text-text-secondary transition-colors duration-120 ease-swift hover:text-text"
          >
            Backfill
          </Link>
          <Link
            href={`/accounts/${account.id}/settings`}
            className="rounded border border-border bg-surface px-2.5 py-1 text-text-secondary transition-colors duration-120 ease-swift hover:text-text"
          >
            Settings
          </Link>
        </div>
      </div>

      {register.length === 0 ? (
        <div className="rounded border border-border bg-surface px-6 py-12 text-center text-sm text-text-secondary shadow-surface">
          No transactions yet. Use{' '}
          <Link href={`/accounts/${account.id}/backfill`} className="text-accent no-underline">
            backfill
          </Link>{' '}
          to paste in your outstanding items from the spreadsheet.
        </div>
      ) : (
        <div className="overflow-hidden rounded border border-border bg-surface shadow-surface">
          <table className="w-full text-dense">
            <thead className="border-b border-border text-xs text-text-tertiary">
              <tr>
                <th className="px-4 py-2 text-left font-normal">Date</th>
                <th className="px-4 py-2 text-left font-normal">Payee</th>
                <th className="px-4 py-2 text-right font-normal">Amount</th>
                <th className="px-4 py-2 text-right font-normal">Balance</th>
              </tr>
            </thead>
            <tbody>
              {register.map((r) => (
                <tr
                  key={r.transaction.id}
                  className="border-b border-border last:border-b-0 hover:bg-canvas"
                >
                  <td className="px-4 py-2 text-text-secondary">{r.transaction.txnDate}</td>
                  <td className="px-4 py-2">
                    {(rows.find((x) => x.id === r.transaction.id)?.payee ?? '—')}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <Amount value={r.transaction.amount} signed />
                  </td>
                  <td className="px-4 py-2 text-right">
                    <Amount value={r.runningBalance} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
