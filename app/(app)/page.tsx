import Link from 'next/link';
import { and, eq } from 'drizzle-orm';
import { Plus } from 'lucide-react';
import { requireAuth } from '@/lib/auth/guards';
import { db } from '@/db/client';
import { accounts as accountsTable, transactions } from '@/db/schema';
import { listAccountsForUser, isoToday, type AccountWithBalance } from '@/server/accounts';
import { computeDashboardStats } from '@/server/stats';
import { Cash, formatCash, formatSigned } from '@/money';
import { Amount } from '@/ui/components/amount';
import { InstitutionBadge } from '@/ui/components/institution-badge';
import { resolveLogoFilename } from '@/ui/components/institution-logos';
import { AccountTypeIcon, accountTypeLabel } from '@/ui/components/account-type-icon';
import { BalanceSparkline } from '@/ui/components/charts/balance-sparkline';
import { BalanceChart } from '@/ui/components/charts/balance-chart';
import { StatCard } from '@/ui/components/stat-card';
import { combinedBalanceTimeSeries } from '@/domain/charts';

export default async function OverviewPage() {
  const { user } = await requireAuth();
  const [accts, stats] = await Promise.all([
    listAccountsForUser(user.id),
    computeDashboardStats(user.id),
  ]);

  // Per-account ledgers for the combined balance chart
  const allTxns = await db
    .select()
    .from(transactions)
    .innerJoin(accountsTable, eq(accountsTable.id, transactions.accountId))
    .where(and(eq(accountsTable.userId, user.id), eq(transactions.isDeleted, false)));
  const byAccount = new Map<string, (typeof transactions.$inferSelect)[]>();
  for (const r of allTxns) {
    const acctId = r.accounts.id;
    const arr = byAccount.get(acctId) ?? [];
    arr.push(r.transactions);
    byAccount.set(acctId, arr);
  }
  const ledgers = accts.map((a) => ({
    account: { openingBalance: Cash.of(a.openingBalance), openingDate: a.openingDate },
    transactions: (byAccount.get(a.id) ?? []).map((t) => ({
      id: t.id,
      txnDate: t.txnDate,
      amount: Cash.of(t.amount),
      clearedState: t.clearedState,
    })),
  }));
  const combinedSeries = combinedBalanceTimeSeries(ledgers, isoToday());

  return (
    <main className="mx-auto max-w-7xl px-6 py-10">
      {/* Hero + headline */}
      <section className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-text-tertiary">
            Net across accounts
          </p>
          <div className="mt-2 flex items-baseline gap-3">
            <span
              className={`amount-display text-5xl leading-none ${
                stats.totalBalance.isNegative() ? 'text-debit' : 'text-stat-1'
              }`}
            >
              {formatCash(stats.totalBalance)}
            </span>
            <span className="text-xs text-text-tertiary">
              {stats.accountCount} account{stats.accountCount === 1 ? '' : 's'} ·{' '}
              {stats.txnCount} transactions
            </span>
          </div>
        </div>
        <Link href="/accounts/new" className="btn-primary">
          <Plus size={14} strokeWidth={2.5} />
          New account
        </Link>
      </section>

      {/* Stat grid */}
      {accts.length > 0 && (
        <section className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatCard
            label="Checking"
            value={formatCash(stats.checkingBalance)}
            subtitle="Cash + checking"
            tone={2}
          />
          <StatCard
            label="Deposits MTD"
            value={formatCash(stats.depositsMtd)}
            subtitle="Month-to-date income"
            tone="credit"
          />
          <StatCard
            label="Payments MTD"
            value={formatCash(stats.paymentsMtd)}
            subtitle={
              <span className={stats.cashflowMtd.isNegative() ? 'text-debit' : 'text-credit'}>
                Net {formatSigned(stats.cashflowMtd)}
              </span>
            }
            tone="debit"
          />
          <StatCard
            label="Cleared"
            value={`${stats.clearedPct}%`}
            subtitle={`${stats.clearedCount} of ${stats.txnCount} txns`}
            tone={6}
          />

          <StatCard
            label="Uncleared"
            value={String(stats.unclearedCount)}
            subtitle={
              stats.oldestUncleared
                ? `Oldest ${stats.oldestUncleared.txnDate} · ${
                    stats.oldestUncleared.payee ?? '—'
                  }`
                : 'none outstanding'
            }
            tone={4}
          />
          <StatCard
            label="Top payee MTD"
            value={stats.topPayeeMtd ? stats.topPayeeMtd.name : '—'}
            subtitle={
              stats.topPayeeMtd ? formatCash(stats.topPayeeMtd.total) : 'no payees yet'
            }
            tone={5}
            className="[&_.stat-value]:text-base [&_.stat-value]:font-semibold"
          />
          <StatCard
            label="Active payees MTD"
            value={String(stats.activePayeesMtd)}
            subtitle={`${stats.totalPayees} total on file`}
            tone={7}
          />
          <StatCard
            label="Credit balance"
            value={formatCash(stats.creditBalance)}
            subtitle={
              stats.creditBalance.isZero()
                ? 'no credit cards yet'
                : 'total owed across cards'
            }
            tone={8}
          />
        </section>
      )}

      {/* Combined balance chart */}
      {accts.length > 0 && (
        <section className="mb-6 card p-4">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-sm font-semibold">Balance over time</h2>
            <span className="text-[11px] text-text-tertiary">
              combined across {stats.accountCount} account
              {stats.accountCount === 1 ? '' : 's'}
            </span>
          </div>
          <BalanceChart data={combinedSeries} height={220} />
        </section>
      )}

      {/* Accounts list */}
      {accts.length === 0 ? <EmptyState /> : <AccountList accounts={accts} />}
    </main>
  );
}

function AccountList({ accounts }: { accounts: AccountWithBalance[] }) {
  return (
    <section className="card overflow-hidden">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold">Accounts</h2>
        <span className="text-[11px] text-text-tertiary">
          {accounts.length} account{accounts.length === 1 ? '' : 's'}
        </span>
      </div>
      <ul className="divide-y divide-border">
        {accounts.map((a) => {
          const first = a.series[0]?.balance ?? 0;
          const last = a.series[a.series.length - 1]?.balance ?? first;
          const trend: 'up' | 'down' | 'flat' =
            last > first ? 'up' : last < first ? 'down' : 'flat';
          return (
            <li key={a.id}>
              <Link
                href={`/accounts/${a.id}`}
                className="flex items-center justify-between gap-4 px-4 py-3 transition-colors duration-120 ease-swift hover:bg-surface-elevated"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <InstitutionBadge
                    institution={a.institution}
                    fallback={a.name}
                    size="md"
                    logoFilename={resolveLogoFilename(a.institution, a.name)}
                  />
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{a.name}</div>
                    <div className="mt-0.5 flex items-center gap-1.5 text-xs text-text-tertiary">
                      <AccountTypeIcon type={a.accountType} />
                      <span>{accountTypeLabel(a.accountType)}</span>
                      {a.institution && <span>· {a.institution}</span>}
                      {a.last4 && <span>····{a.last4}</span>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-5">
                  <BalanceSparkline data={a.series} trend={trend} width={110} height={30} />
                  <Amount value={a.currentBalance} className="amount-display text-lg" />
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function EmptyState() {
  return (
    <div className="card flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      <h2 className="text-base font-semibold">Start by creating an account.</h2>
      <p className="max-w-md text-sm text-text-secondary">
        Set the opening balance from your statement, then paste in any outstanding
        transactions from your spreadsheet.
      </p>
      <Link href="/accounts/new" className="btn-primary">
        <Plus size={14} strokeWidth={2.5} />
        Create first account
      </Link>
    </div>
  );
}
