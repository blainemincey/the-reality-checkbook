import Link from 'next/link';
import { requireAuth } from '@/lib/auth/guards';
import { NewAccountForm } from './new-account-form';

export default async function NewAccountPage() {
  await requireAuth();
  return (
    <main className="mx-auto max-w-xl px-6 py-10">
      <div className="mb-6">
        <Link
          href="/"
          className="text-xs text-text-tertiary transition-colors duration-120 ease-swift hover:text-text-secondary"
        >
          ← Accounts
        </Link>
        <h1 className="mt-2 text-lg font-medium">New account</h1>
        <p className="mt-1 text-sm text-text-secondary">
          The opening balance lives on the account itself, not as a transaction. Pick the
          date and amount that match your starting statement.
        </p>
      </div>
      <NewAccountForm />
    </main>
  );
}
