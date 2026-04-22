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
import { resolveLogoFilename } from '@/ui/components/institution-logos';
import { AccountTypeIcon, accountTypeLabel } from '@/ui/components/account-type-icon';
import { BalanceChart } from '@/ui/components/charts/balance-chart';
import { StatCard } from '@/ui/components/stat-card';
import { EntryRow } from './entry-row';
import { RegisterTable, type RegisterRowData } from './register-table';

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
                logoFilename={resolveLogoFilename(account.institution, account.name)}
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
        <RegisterTable
          openingDate={account.openingDate}
          payees={payees.map((p) => ({ id: p.id, name: p.name }))}
          rows={register.map<RegisterRowData>((r) => {
            const raw = byId.get(r.transaction.id)!;
            return {
              id: raw.id,
              txnDate: raw.txnDate,
              payee: raw.payee,
              memo: raw.memo,
              checkNumber: raw.checkNumber,
              amount: raw.amount,
              kind: raw.kind,
              clearedState: raw.clearedState,
              payeeId: raw.payeeId,
              runningBalance: r.runningBalance.toString(),
            };
          })}
        />
      )}
    </main>
  );
}
