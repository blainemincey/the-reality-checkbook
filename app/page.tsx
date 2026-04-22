import { Cash } from '@/money';
import { formatCash, formatSigned } from '@/money';

export default function Page() {
  // Temporary landing page. Replaced by the real shell + account list in Phase 2.
  const sample = [Cash.of('4231.07'), Cash.of('-847.22'), Cash.of('-247.22'), Cash.of('3136.63')];

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <header className="mb-10">
        <p className="text-tertiary text-xs uppercase tracking-wider">check register</p>
        <h1 className="mt-2 text-2xl font-medium">Phase 0 — foundation wired up.</h1>
        <p className="mt-3 text-sm text-text-secondary">
          Bootstrap and register UI land in Phase 1 and Phase 2. This page exists so the
          typography, color tokens, and money formatting are visible from day one.
        </p>
      </header>

      <section className="rounded border border-border bg-surface shadow-surface">
        <div className="border-b border-border px-4 py-3 text-xs uppercase tracking-wider text-text-secondary">
          Sample amounts
        </div>
        <ul>
          {sample.map((c, i) => (
            <li
              key={i}
              className="flex items-center justify-between border-b border-border px-4 py-2 last:border-b-0"
            >
              <span className="text-sm text-text-secondary">
                {i === 0 ? 'opening balance' : i === sample.length - 1 ? 'projected' : 'txn'}
              </span>
              <span
                className={
                  'amount text-sm ' + (c.isNegative() ? 'text-debit' : 'text-credit')
                }
              >
                {i === 0 || i === sample.length - 1 ? formatCash(c) : formatSigned(c)}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
