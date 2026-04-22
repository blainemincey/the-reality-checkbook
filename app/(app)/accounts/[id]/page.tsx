import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAuth } from '@/lib/auth/guards';
import { getAccount } from '@/server/accounts';
import { listPayees } from '@/server/payees';
import { db } from '@/db/client';
import { transactions } from '@/db/schema';
import { and, eq } from 'drizzle-orm';
import { Cash } from '@/money';
import { registerRows } from '@/domain/accounts';
import { balanceTimeSeries } from '@/domain/charts';
import { BalanceChart } from '@/ui/components/charts/balance-chart';
import { isoToday } from '@/server/accounts';
import { Amount } from '@/ui/components/amount';
import { InstitutionBadge } from '@/ui/components/institution-badge';
import { AccountTypeIcon, accountTypeLabel } from '@/ui/components/account-type-icon';
import { formatCash } from '@/money';
import { EntryRow } from './entry-row';

export default async function AccountPage({ params }: { params: Promise<{ id: string }> }) {
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

  const register = registerRows(
    { openingBalance: Cash.of(account.openingBalance), openingDate: account.openingDate },
    txRows.map((r) => ({
      id: r.id,
      txnDate: r.txnDate,
      amount: Cash.of(r.amount),
      clearedState: r.clearedState,
    })),
  );

  const byId = new Map(txRows.map((r) => [r.id, r]));

  const currentBalance =
    register.length > 0
      ? register[register.length - 1]!.runningBalance
      : Cash.of(account.openingBalance);
  const clearedBalance = txRows
    .filter((t) => t.clearedState !== 'uncleared')
    .reduce((acc, t) => acc.add(Cash.of(t.amount)), Cash.of(account.openingBalance));

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <div className="mb-6">
        <Link
          href="/"
          className="text-xs text-text-tertiary transition-colors duration-120 ease-swift hover:text-text-secondary"
        >
          ← Accounts
        </Link>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
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
              <h1 className="truncate text-lg font-medium">{account.name}</h1>
              <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-text-tertiary">
                <AccountTypeIcon type={account.accountType} />
                <span>{accountTypeLabel(account.accountType)}</span>
                {account.institution && <span>· {account.institution}</span>}
                {account.last4 && <span>····{account.last4}</span>}
                <span>
                  · opened {account.openingDate} at{' '}
                  {formatCash(Cash.of(account.openingBalance))}
                </span>
              </p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-wider text-text-tertiary">
              Current
            </div>
            <Amount value={currentBalance} className="amount-display text-2xl" />
            <div className="mt-0.5 text-[10px] text-text-tertiary">
              cleared: {formatCash(clearedBalance)}
            </div>
          </div>
        </div>
        <div className="mt-4 flex items-center gap-2 text-xs">
          <Link href={`/accounts/${account.id}/backfill`} className="btn-ghost">
            Backfill
          </Link>
          <Link href={`/accounts/${account.id}/settings`} className="btn-ghost">
            Settings
          </Link>
        </div>
      </div>

      <div className="mb-6">
        <BalanceChart
          data={balanceTimeSeries(
            { openingBalance: Cash.of(account.openingBalance), openingDate: account.openingDate },
            txRows.map((r) => ({
              id: r.id,
              txnDate: r.txnDate,
              amount: Cash.of(r.amount),
              clearedState: r.clearedState,
            })),
            isoToday(),
          )}
        />
      </div>

      <div className="mb-6">
        <EntryRow
          accountId={account.id}
          openingDate={account.openingDate}
          payees={payees.map((p) => ({ id: p.id, name: p.name }))}
        />
      </div>

      {register.length === 0 ? (
        <div className="rounded-lg border border-border bg-surface px-6 py-12 text-center text-sm text-text-secondary">
          No transactions yet. Add one above, or use{' '}
          <Link href={`/accounts/${account.id}/backfill`} className="text-accent no-underline">
            backfill
          </Link>{' '}
          to paste rows from a spreadsheet.
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-surface">
          <table className="w-full text-dense">
            <thead className="border-b border-border bg-canvas text-xs text-text-tertiary">
              <tr>
                <th className="w-10 px-3 py-2 text-center font-normal">✓</th>
                <th className="w-24 px-3 py-2 text-left font-normal">Date</th>
                <th className="w-24 px-3 py-2 text-left font-normal">Kind</th>
                <th className="px-3 py-2 text-left font-normal">Payee / Memo</th>
                <th className="w-24 px-3 py-2 text-right font-normal">Payment</th>
                <th className="w-24 px-3 py-2 text-right font-normal">Deposit</th>
                <th className="w-28 px-3 py-2 text-right font-normal">Balance</th>
              </tr>
            </thead>
            <tbody>
              {[...register].reverse().map((r) => {
                const raw = byId.get(r.transaction.id)!;
                const isPayment = r.transaction.amount.isNegative();
                const cleared =
                  raw.clearedState === 'cleared' || raw.clearedState === 'reconciled';
                return (
                  <tr
                    key={r.transaction.id}
                    className={`border-b border-border last:border-b-0 ${
                      cleared ? '' : 'bg-canvas/50'
                    }`}
                  >
                    <td className="px-3 py-2 text-center">
                      {cleared ? (
                        <span
                          className="inline-block h-2 w-2 rounded-full bg-credit"
                          title={raw.clearedState}
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
                      {raw.kind ?? '—'}
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
      )}
    </main>
  );
}
