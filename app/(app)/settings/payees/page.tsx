import { requireAuth } from '@/lib/auth/guards';
import { listPayees, listArchivedPayees } from '@/server/payees';
import { NewPayeeForm } from './new-payee-form';
import { PayeeRow } from './payee-row';

export default async function PayeesSettingsPage() {
  const { user } = await requireAuth();
  const [active, archived] = await Promise.all([
    listPayees(user.id),
    listArchivedPayees(user.id),
  ]);

  return (
    <>
      <header className="mb-8">
        <h1 className="text-lg font-medium">Payees</h1>
        <p className="mt-1 text-sm text-text-secondary">
          The list of vendors and deposit sources available in the register's
          dropdown. Archive to hide from the picker without losing transaction
          history; delete to remove entirely (transactions keep their payee
          name on the row).
        </p>
      </header>

      <section className="mb-8">
        <NewPayeeForm />
      </section>

      <section className="mb-10">
        <h2 className="mb-2 text-xs uppercase tracking-wider text-text-tertiary">
          Active ({active.length})
        </h2>
        {active.length === 0 ? (
          <p className="rounded-lg border border-border bg-surface px-4 py-8 text-center text-sm text-text-secondary">
            No payees yet. Add your first one above — e.g. "Target", "Electric
            Co", "Direct Deposit".
          </p>
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface">
            {active.map((p) => (
              <PayeeRow key={p.id} payee={p} archived={false} />
            ))}
          </ul>
        )}
      </section>

      {archived.length > 0 && (
        <section>
          <h2 className="mb-2 text-xs uppercase tracking-wider text-text-tertiary">
            Archived ({archived.length})
          </h2>
          <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface opacity-70">
            {archived.map((p) => (
              <PayeeRow key={p.id} payee={p} archived />
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
