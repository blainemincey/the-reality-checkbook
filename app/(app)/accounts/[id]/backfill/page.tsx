import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAuth } from '@/lib/auth/guards';
import { getAccount } from '@/server/accounts';
import { BackfillWorkspace } from './backfill-workspace';

export default async function BackfillPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { user } = await requireAuth();
  const { id } = await params;
  const account = await getAccount(user.id, id);
  if (!account) notFound();

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <div className="mb-6">
        <Link
          href={`/accounts/${account.id}`}
          className="text-xs text-text-tertiary transition-colors duration-120 ease-swift hover:text-text-secondary"
        >
          ← {account.name}
        </Link>
        <h1 className="mt-2 text-lg font-medium">Backfill</h1>
        <p className="mt-1 max-w-2xl text-sm text-text-secondary">
          Paste rows from your spreadsheet below — date, payee, amount, memo. The
          parser guesses columns; you can fix the mapping before committing.
          Toggle a row's cleared state per check/charge you know has or hasn't
          hit yet.
        </p>
      </div>
      <BackfillWorkspace
        accountId={account.id}
        openingBalance={account.openingBalance}
        openingDate={account.openingDate}
      />
    </main>
  );
}
