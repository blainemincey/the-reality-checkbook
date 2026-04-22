import Link from 'next/link';
import { notFound } from 'next/navigation';
import { and, eq } from 'drizzle-orm';
import { requireAuth } from '@/lib/auth/guards';
import { getAccount, isoToday } from '@/server/accounts';
import { listPayees } from '@/server/payees';
import { db } from '@/db/client';
import { transactions } from '@/db/schema';
import { Cash } from '@/money';
import { registerRows } from '@/domain/accounts';
import { balanceTimeSeries } from '@/domain/charts';
import { formatCash } from '@/money';
import { Amount } from '@/ui/components/amount';
import { InstitutionBadge } from '@/ui/components/institution-badge';
import { AccountTypeIcon, accountTypeLabel } from '@/ui/components/account-type-icon';
import { BalanceChart } from '@/ui/components/charts/balance-chart';
import { StatCard } from '@/ui/components/stat-card';
import { EntryRow } from './entry-row';

export default async function AccountPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { user } = await requireAuth();
  const { id } = await params;
  const account = await getAccount(user.id, id);
  if (!account) notFound();

  const [txRows, payees] = await Promise.all([
    db
      .select()
      .from(transactions)
      .where(and(eq(transactions.accountId, account.id), eq(transactions.isDeleted, false))),
    listPayees(user.id),
  ]);

  const openingCash = Cash.of(account.openingBalance);
  const ledger = txRows.map((r) => ({
    id: r.id,
    txnDate: r.txnDate,
    amount: Cash.of(r.amount),
    clearedState: r.clearedState,
  }));
  const register = registerRows(
    { openingBalance: openingCash, openingDate: account.openingDate },
    ledger,
  );
  const byId = new Map(txRows.map((r) => [r.id, r]));

  const currentBalance =
    register.length > 0
      ? register[register.length - 1]!.runningBalance
      : openingCash;
  const clearedBalance = txRows
    .filter((t) => t.clearedState !== 'uncleared')
    .reduce((acc, t) => acc.add(Cash.of(t.amount)), openingCash);
  const unclearedSum = txRows
    .filter((t) => t.clearedState === 'uncleared')
    .reduce((acc, t) => acc.add(Cash.of(t.amount)), Cash.zero());

  const unclearedCount = txRows.filter((t) => t.clearedState === 'uncleared').length;
  const clearedCount = txRows.length - unclearedCount;
  const clearedPct = txRows.length > 0 ? Math.round((clearedCount / txRows.length) * 100) : 0;

  const series = balanceTimeSeries(
    { openingBalance: openingCash, openingDate: account.openingDate },
    ledger,
    isoToday(),
  );

  return (
    <main className="mx-auto max-w-7xl px-6 py-10">
      {/* Account header */}
      <div className="mb-8">
        <Link
          href="/"
          className="text-xs text-text-tertiary transition-colors duration-120 ease-swift hover:text-text-secondary"
        >
          ← Accounts
        </Link>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-4">
            <Link
              href="/settings/institutions"
              title={
                account.institution
                  ? `Manage logo for ${account.institution}`
                  : 'Manage institution logos'
              }
              className="rounded-md transition-transform duration-120 ease-swift hover:scale-105"
            >
              <InstitutionBadge
                institution={account.institution}
                fallback={account.name}
                size="lg"
              />
            </Link>
            <div className="min-w-0">
              <h1 className="truncate text-2xl font-semibold tracking-tight">
                {account.name}
              </h1>
              <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-text-tertiary">
                <span className="inline-flex items-center gap-1">
                  <AccountTypeIcon type={account.accountType} />
                  {accountTypeLabel(account.accountType)}
                </span>
                {account.institution && <span>· {account.institution}</span>}
                {account.last4 && <span>····{account.last4}</span>}
                <span>· opened {account.openingDate}</span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href={`/accounts/${account.id}/backfill`} className="btn-ghost">
              Backfill
            </Link>
            <Link href={`/accounts/${account.id}/settings`} className="btn-ghost">
              Settings
            </Link>
          </div>
        </div>
      </div>

      {/* Per-account stat grid */}
      <section className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard
          label="Current balance"
          value={formatCash(currentBalance)}
          subtitle={`opening ${formatCash(openingCash)}`}
          tone={currentBalance.isNegative() ? 'debit' : 1}
        />
        <StatCard
          label="Cleared"
          value={formatCash(clearedBalance)}
          subtitle={`${clearedCount} of ${txRows.length} txns · ${clearedPct}%`}
          tone={6}
        />
        <StatCard
          label="Uncleared"
          value={String(unclearedCount)}
          subtitle={unclearedCount > 0 ? `total ${formatCash(unclearedSum)}` : 'none outstanding'}
          tone={4}
        />
        <StatCard
          label="Transactions"
          value={String(txRows.length)}
          subtitle={`since ${account.openingDate}`}
          tone={5}
        />
      </section>

      {/* Balance chart */}
      <section className="mb-6 card p-4">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-sm font-semibold">Balance over time</h2>
          <span className="text-[11px] text-text-tertiary">since {account.openingDate}</span>
        </div>
        <BalanceChart data={series} height={200} />
      </section>

      {/* Entry row */}
      <section className="mb-6">
        <EntryRow
          accountId={account.id}
          openingDate={account.openingDate}
          payees={payees.map((p) => ({ id: p.id, name: p.name }))}
        />
      </section>

      {/* Register */}
      {register.length === 0 ? (
        <div className="card flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
          <p className="text-sm text-text-secondary">
            No transactions yet. Add one above, or{' '}
            <Link
              href={`/accounts/${account.id}/backfill`}
              className="text-accent no-underline"
            >
              backfill
            </Link>{' '}
            from a spreadsheet.
          </p>
        </div>
      ) : (
        <section className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h2 className="text-sm font-semibold">Register</h2>
            <span className="text-[11px] text-text-tertiary">
              newest first · {register.length} rows
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-dense">
              <thead className="border-b border-border text-[11px] uppercase tracking-wider text-text-tertiary">
                <tr>
                  <th className="w-10 px-3 py-2 text-center font-medium">✓</th>
                  <th className="w-24 px-3 py-2 text-left font-medium">Date</th>
                  <th className="w-28 px-3 py-2 text-left font-medium">Kind</th>
                  <th className="px-3 py-2 text-left font-medium">Payee / Memo</th>
                  <th className="w-28 px-3 py-2 text-right font-medium">Payment</th>
                  <th className="w-28 px-3 py-2 text-right font-medium">Deposit</th>
                  <th className="w-32 px-3 py-2 text-right font-medium">Balance</th>
                </tr>
              </thead>
              <tbody>
                {[...register].reverse().map((r) => {
                  const raw = byId.get(r.transaction.id)!;
                  const isPayment = r.transaction.amount.isNegative();
                  const cleared =
                    raw.clearedState === 'cleared' || raw.clearedState === 'reconciled';
                  const reconciled = raw.clearedState === 'reconciled';
                  return (
                    <tr
                      key={r.transaction.id}
                      className="border-b border-border last:border-b-0 transition-colors hover:bg-surface-elevated"
                    >
                      <td className="px-3 py-2 text-center">
                        {reconciled ? (
                          <span
                            className="inline-block h-2 w-2 rounded-full bg-stat-6"
                            title="reconciled"
                          />
                        ) : cleared ? (
                          <span
                            className="inline-block h-2 w-2 rounded-full bg-credit"
                            title="cleared"
                          />
                        ) : (
                          <span
                            className="inline-block h-2 w-2 rounded-full border border-border-strong"
                            title="uncleared"
                          />
                        )}
                      </td>
                      <td className="px-3 py-2 text-text-secondary">{r.transaction.txnDate}</td>
                      <td className="px-3 py-2 text-xs capitalize text-text-tertiary">
                        {raw.kind ? raw.kind.replace('_', ' ') : '—'}
                      </td>
                      <td className="px-3 py-2">
                        <div className="truncate">{raw.payee || '—'}</div>
                        {(raw.memo || raw.checkNumber) && (
                          <div className="mt-0.5 truncate text-[11px] text-text-tertiary">
                            {raw.checkNumber && (
                              <span className="mr-2">#{raw.checkNumber}</span>
                            )}
                            {raw.memo}
                          </div>
                        )}
                      </td>
                      <td className="amount px-3 py-2 text-debit">
                        {isPayment ? r.transaction.amount.abs().toFixed(2) : ''}
                      </td>
                      <td className="amount px-3 py-2 text-credit">
                        {!isPayment && !r.transaction.amount.isZero()
                          ? r.transaction.amount.toFixed(2)
                          : ''}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Amount value={r.runningBalance} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </main>
  );
}
