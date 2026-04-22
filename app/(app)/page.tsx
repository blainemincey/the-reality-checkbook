import Link from 'next/link';
import { Plus } from 'lucide-react';
import { requireAuth } from '@/lib/auth/guards';
import { listAccountsForUser, type AccountWithBalance } from '@/server/accounts';
import { Cash, formatCash } from '@/money';
import { Amount } from '@/ui/components/amount';
import { InstitutionBadge } from '@/ui/components/institution-badge';
import { AccountTypeIcon, accountTypeLabel } from '@/ui/components/account-type-icon';

export default async function AccountsListPage() {
  const { user } = await requireAuth();
  const accounts = await listAccountsForUser(user.id);

  const total = Cash.sum(accounts.map((a) => a.currentBalance));
  const checkingTotal = Cash.sum(
    accounts.filter((a) => a.accountType === 'checking').map((a) => a.currentBalance),
  );
  const savingsTotal = Cash.sum(
    accounts.filter((a) => a.accountType === 'savings').map((a) => a.currentBalance),
  );
  const creditTotal = Cash.sum(
    accounts.filter((a) => a.accountType === 'credit_card').map((a) => a.currentBalance),
  );

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-wider text-text-tertiary">
            {accounts.length === 0 ? 'Get started' : 'Overall'}
          </p>
          <div className="mt-1 flex items-baseline gap-3">
            <span
              className={
                'amount-display text-4xl ' +
                (total.isNegative() ? 'text-debit' : 'text-text')
              }
            >
              {formatCash(total)}
            </span>
            <span className="text-sm text-text-tertiary">
              across {accounts.length} account{accounts.length === 1 ? '' : 's'}
            </span>
          </div>
        </div>
        <Link href="/accounts/new" className="btn-primary">
          <Plus size={14} strokeWidth={2} />
          New account
        </Link>
      </header>

      {accounts.length > 0 && (
        <section className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Rollup
            label="Checking"
            value={checkingTotal}
            count={accounts.filter((a) => a.accountType === 'checking').length}
          />
          <Rollup
            label="Savings"
            value={savingsTotal}
            count={accounts.filter((a) => a.accountType === 'savings').length}
          />
          <Rollup
            label="Credit"
            value={creditTotal}
            count={accounts.filter((a) => a.accountType === 'credit_card').length}
          />
        </section>
      )}

      {accounts.length === 0 ? <EmptyState /> : <AccountList accounts={accounts} />}
    </main>
  );
}

function Rollup({ label, value, count }: { label: string; value: Cash; count: number }) {
  if (count === 0) {
    return (
      <div className="rounded-lg border border-border bg-surface px-4 py-3 opacity-50">
        <div className="text-xs uppercase tracking-wider text-text-tertiary">{label}</div>
        <div className="mt-1 text-sm text-text-tertiary">—</div>
      </div>
    );
  }
  return (
    <div className="rounded-lg border border-border bg-surface px-4 py-3">
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wider text-text-tertiary">{label}</span>
        <span className="text-[10px] text-text-tertiary">
          {count} account{count === 1 ? '' : 's'}
        </span>
      </div>
      <Amount value={value} className="amount-display mt-1 block text-xl" />
    </div>
  );
}

function AccountList({ accounts }: { accounts: AccountWithBalance[] }) {
  return (
    <section>
      <h2 className="mb-2 text-xs uppercase tracking-wider text-text-tertiary">Accounts</h2>
      <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface">
        {accounts.map((a) => (
          <li key={a.id}>
            <Link
              href={`/accounts/${a.id}`}
              className="flex items-center justify-between gap-4 px-4 py-3 transition-colors duration-120 ease-swift hover:bg-canvas"
            >
              <div className="flex min-w-0 items-center gap-3">
                <InstitutionBadge institution={a.institution} fallback={a.name} size="md" />
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
              <Amount value={a.currentBalance} className="text-base font-medium" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function EmptyState() {
  return (
    <div className="rounded-lg border border-border bg-surface px-6 py-12 text-center">
      <h2 className="text-sm font-medium">Start by creating an account.</h2>
      <p className="mx-auto mt-2 max-w-sm text-sm text-text-secondary">
        Set its opening balance from your statement, then paste any outstanding
        transactions from your spreadsheet into the backfill grid.
      </p>
      <Link href="/accounts/new" className="btn-primary mt-4">
        <Plus size={14} strokeWidth={2} />
        Create first account
      </Link>
    </div>
  );
}
