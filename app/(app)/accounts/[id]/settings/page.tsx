import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAuth } from '@/lib/auth/guards';
import { getAccount } from '@/server/accounts';
import { SettingsForm } from './settings-form';

export default async function AccountSettingsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { user } = await requireAuth();
  const { id } = await params;
  const account = await getAccount(user.id, id);
  if (!account) notFound();

  return (
    <main className="mx-auto max-w-xl px-6 py-10">
      <div className="mb-6">
        <Link
          href={`/accounts/${account.id}`}
          className="text-xs text-text-tertiary transition-colors duration-120 ease-swift hover:text-text-secondary"
        >
          ← {account.name}
        </Link>
        <h1 className="mt-2 text-lg font-medium">Settings</h1>
      </div>

      <SettingsForm
        accountId={account.id}
        defaults={{
          name: account.name,
          openingBalance: account.openingBalance,
          openingDate: account.openingDate,
          institution: account.institution ?? '',
          last4: account.last4 ?? '',
        }}
      />

      <div className="mt-10 border-t border-border pt-6">
        <h2 className="mb-2 text-xs uppercase tracking-wider text-text-tertiary">
          Bootstrap
        </h2>
        <p className="mb-3 text-sm text-text-secondary">
          Paste more rows from a spreadsheet at any time — backfill is a
          re-openable flow, not a one-shot setup.
        </p>
        <Link
          href={`/accounts/${account.id}/backfill`}
          className="inline-block rounded border border-border bg-surface px-3 py-1.5 text-xs transition-colors duration-120 ease-swift hover:bg-canvas"
        >
          Open backfill
        </Link>
      </div>
    </main>
  );
}
