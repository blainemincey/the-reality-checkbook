import Link from 'next/link';
import { requireAuth } from '@/lib/auth/guards';
import { listAccountsForUser } from '@/server/accounts';
import { Amount } from '@/ui/components/amount';
import { InstitutionBadge } from '@/ui/components/institution-badge';

export default async function AccountsListPage() {
  const { user } = await requireAuth();
  const accounts = await listAccountsForUser(user.id);

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <div className="mb-8 flex items-baseline justify-between">
        <h1 className="text-lg font-medium">Accounts</h1>
        <Link
          href="/accounts/new"
          className="rounded bg-accent px-3 py-1.5 text-xs font-medium text-white transition-opacity duration-120 ease-swift hover:opacity-90"
        >
          New account
        </Link>
      </div>

      {accounts.length === 0 ? (
        <EmptyState />
      ) : (
        <ul className="divide-y divide-border rounded border border-border bg-surface shadow-surface">
          {accounts.map((a) => (
            <li key={a.id}>
              <Link
                href={`/accounts/${a.id}`}
                className="flex items-center justify-between gap-3 px-4 py-3 transition-colors duration-120 ease-swift hover:bg-canvas"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <InstitutionBadge institution={a.institution} fallback={a.name} size="md" />
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{a.name}</div>
                    <div className="mt-0.5 text-xs text-text-tertiary">
                      {a.institution ? `${a.institution} · ` : ''}
                      {a.accountType.replace('_', ' ')}
                      {a.last4 ? ` ····${a.last4}` : ''}
                    </div>
                  </div>
                </div>
                <Amount value={a.currentBalance} className="text-sm" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

function EmptyState() {
  return (
    <div className="rounded border border-border bg-surface px-6 py-12 text-center shadow-surface">
      <h2 className="text-sm font-medium">Start by creating an account.</h2>
      <p className="mx-auto mt-2 max-w-sm text-sm text-text-secondary">
        Set its opening balance from your statement, then paste any outstanding
        transactions from your spreadsheet into the backfill grid.
      </p>
      <Link
        href="/accounts/new"
        className="mt-4 inline-block rounded bg-accent px-3 py-1.5 text-xs font-medium text-white transition-opacity duration-120 ease-swift hover:opacity-90"
      >
        Create first account
      </Link>
    </div>
  );
}
