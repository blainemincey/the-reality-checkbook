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
    <main className="mx-auto max-w-7xl px-6 py-10">
      <div className="mb-8">
        <Link
          href={`/accounts/${account.id}`}
          className="text-xs text-text-tertiary transition-colors duration-120 ease-swift hover:text-text-secondary"
        >
          ← {account.name}
        </Link>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">Backfill</h1>
        <p className="mt-1.5 max-w-2xl text-sm text-text-secondary">
          Paste rows from your spreadsheet below — date, payee, amount, memo.
          The parser guesses column types; fix the mapping before committing,
          and mark each row's cleared state as you know it.
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
