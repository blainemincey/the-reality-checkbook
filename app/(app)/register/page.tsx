import Link from 'next/link';
import { and, eq } from 'drizzle-orm';
import { requireAuth } from '@/lib/auth/guards';
import { db } from '@/db/client';
import { accounts, transactions } from '@/db/schema';
import { Cash, formatCash, formatSigned } from '@/money';
import { unifiedLedger } from '@/domain/unified-ledger';
import { StatCard } from '@/ui/components/stat-card';
import { resolveLogoFilename } from '@/ui/components/institution-logos';
import { listPayees } from '@/server/payees';
import { EntryRow } from '../accounts/[id]/entry-row';
import {
  UnifiedRegisterTable,
  type UnifiedRegisterRow,
} from './unified-register-table';

export default async function RegisterPage() {
  const { user } = await requireAuth();

  const acctRows = await db
    .select()
    .from(accounts)
    .where(and(eq(accounts.userId, user.id), eq(accounts.isArchived, false)));

  const payees = await listPayees(user.id);

  const txnRows = await db
    .select()
    .from(transactions)
    .innerJoin(accounts, eq(accounts.id, transactions.accountId))
    .where(and(eq(accounts.userId, user.id), eq(transactions.isDeleted, false)));

  const ledgerInputs = txnRows.map((r) => ({
    id: r.transactions.id,
    accountId: r.transactions.accountId,
    txnDate: r.transactions.txnDate,
    amount: Cash.of(r.transactions.amount),
    clearedState: r.transactions.clearedState,
  }));

  const accountInputs = acctRows.map((a) => ({
    id: a.id,
    openingBalance: Cash.of(a.openingBalance),
    openingDate: a.openingDate,
  }));

  const ledger = unifiedLedger(accountInputs, ledgerInputs);

  const txnById = new Map(txnRows.map((r) => [r.transactions.id, r.transactions]));
  const acctById = new Map(acctRows.map((a) => [a.id, a]));

  const rows: UnifiedRegisterRow[] = ledger.map((r) => {
    const raw = txnById.get(r.id)!;
    const acct = acctById.get(r.accountId)!;
    return {
      id: r.id,
      accountId: r.accountId,
      accountName: acct.name,
      accountInstitution: acct.institution,
      accountOpeningDate: acct.openingDate,
      accountLogoFilename: resolveLogoFilename(acct.institution, acct.name),
      txnDate: r.txnDate,
      payee: raw.payee,
      payeeId: raw.payeeId,
      memo: raw.memo,
      checkNumber: raw.checkNumber,
      kind: raw.kind,
      amount: raw.amount,
      clearedState: r.clearedState,
      runningBalance: r.runningBalance.toString(),
    };
  });

  const combinedOpening = accountInputs.reduce(
    (acc, a) => acc.add(a.openingBalance),
    Cash.zero(),
  );
  const combinedCurrent =
    ledger.length > 0 ? ledger[ledger.length - 1]!.runningBalance : combinedOpening;

  const uncleared = rows.filter((r) => r.clearedState === 'uncleared');
  const unclearedSum = Cash.sum(uncleared.map((r) => Cash.of(r.amount)));

  const accountFilters = acctRows.map((a) => ({ id: a.id, name: a.name }));

  return (
    <main className="mx-auto max-w-7xl px-6 py-10">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Register</h1>
        <p className="mt-1.5 max-w-2xl text-sm text-text-secondary">
          Every transaction across every account, chronologically interleaved,
          with a single combined running balance — the spreadsheet view.
        </p>
      </header>

      <section className="mb-6 grid grid-cols-1 gap-3 md:grid-cols-3">
        <StatCard
          label="Combined balance"
          value={formatCash(combinedCurrent)}
          subtitle={`across ${acctRows.length} account${acctRows.length === 1 ? '' : 's'}`}
          tone={combinedCurrent.isNegative() ? 'debit' : 1}
        />
        <StatCard
          label="Transactions"
          value={String(rows.length)}
          subtitle="all active rows"
          tone={2}
        />
        <StatCard
          label="Uncleared"
          value={String(uncleared.length)}
          subtitle={
            uncleared.length === 0
              ? 'nothing outstanding'
              : `${formatSigned(unclearedSum)} pending`
          }
          tone={4}
        />
      </section>

      {acctRows.length > 0 && (
        <section className="mb-6">
          <EntryRow
            accounts={acctRows.map((a) => ({
              id: a.id,
              name: a.name,
              openingDate: a.openingDate,
            }))}
            payees={payees.map((p) => ({ id: p.id, name: p.name }))}
          />
        </section>
      )}

      {rows.length === 0 ? (
        <div className="card flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
          <p className="text-sm text-text-secondary">
            No transactions yet.
            {acctRows.length === 0 && (
              <>
                {' '}
                Create an{' '}
                <Link href="/accounts/new" className="text-accent no-underline">
                  account
                </Link>{' '}
                first.
              </>
            )}
          </p>
        </div>
      ) : (
        <UnifiedRegisterTable
          rows={rows}
          accounts={accountFilters}
          accountsWithOpening={acctRows.map((a) => ({
            id: a.id,
            name: a.name,
            openingDate: a.openingDate,
          }))}
          payees={payees.map((p) => ({ id: p.id, name: p.name }))}
        />
      )}
    </main>
  );
}
