import { requireAuth } from '@/lib/auth/guards';
import {
  listArchivedCreditCards,
  listCreditCards,
  creditCardTotal,
} from '@/server/credit-cards';
import { formatCash } from '@/money';
import { resolveLogoFilename } from '@/ui/components/institution-logos';
import { NewCreditCardForm } from './new-credit-card-form';
import { CreditCardRow } from './credit-card-row';

export default async function CreditCardsSettingsPage() {
  const { user } = await requireAuth();
  const [active, archived, total] = await Promise.all([
    listCreditCards(user.id),
    listArchivedCreditCards(user.id),
    creditCardTotal(user.id),
  ]);

  const withLogos = active.map((c) => ({
    ...c,
    logoFilename: resolveLogoFilename(c.institution, c.name),
  }));

  return (
    <>
      <header className="mb-8">
        <h1 className="text-lg font-medium">Credit cards</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Track outstanding balances per card. Edit the amount when you check
          your statement; we stamp the update time. The total rolls up to the{' '}
          <span className="font-medium text-stat-8">Credit balance</span> card
          on the Overview dashboard.
        </p>
      </header>

      <section className="mb-6 card flex items-baseline justify-between px-4 py-3">
        <span className="text-xs uppercase tracking-wider text-text-tertiary">
          Total owed
        </span>
        <span className="amount-display text-2xl text-stat-8">
          {formatCash(total)}
        </span>
      </section>

      <section className="mb-8 card p-4">
        <h2 className="mb-3 text-xs uppercase tracking-wider text-text-tertiary">
          Add credit card
        </h2>
        <NewCreditCardForm />
      </section>

      <section className="mb-10">
        <h2 className="mb-2 text-xs uppercase tracking-wider text-text-tertiary">
          Active ({active.length})
        </h2>
        {active.length === 0 ? (
          <p className="card px-4 py-8 text-center text-sm text-text-secondary">
            No credit cards yet. Add your first above — e.g. "BofA", "Amex Cash
            Preferred".
          </p>
        ) : (
          <ul className="card divide-y divide-border overflow-hidden">
            {withLogos.map((c) => (
              <CreditCardRow
                key={c.id}
                card={{
                  id: c.id,
                  name: c.name,
                  institution: c.institution,
                  last4: c.last4,
                  amountOwed: c.amountOwed,
                  lastUpdatedAt: c.lastUpdatedAt.toISOString(),
                  logoFilename: c.logoFilename,
                }}
                archived={false}
              />
            ))}
          </ul>
        )}
      </section>

      {archived.length > 0 && (
        <section>
          <h2 className="mb-2 text-xs uppercase tracking-wider text-text-tertiary">
            Archived ({archived.length})
          </h2>
          <ul className="card divide-y divide-border overflow-hidden opacity-70">
            {archived.map((c) => (
              <CreditCardRow
                key={c.id}
                card={{
                  id: c.id,
                  name: c.name,
                  institution: c.institution,
                  last4: c.last4,
                  amountOwed: c.amountOwed,
                  lastUpdatedAt: c.lastUpdatedAt.toISOString(),
                  logoFilename: resolveLogoFilename(c.institution, c.name),
                }}
                archived
              />
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
