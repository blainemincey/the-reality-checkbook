import { LineChart } from 'lucide-react';
import { requireAuth } from '@/lib/auth/guards';

export default async function ReportsPage() {
  await requireAuth();
  return (
    <main className="mx-auto max-w-7xl px-6 py-10">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Reports</h1>
        <p className="mt-1.5 max-w-2xl text-sm text-text-secondary">
          Cashflow, spending by category, biggest payees, payee-over-time trends.
        </p>
      </header>
      <div className="card flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-accent-soft text-accent">
          <LineChart size={22} strokeWidth={1.5} />
        </div>
        <p className="text-sm text-text-secondary">
          Arrives with v1.1 — after categories are wired into the entry form.
        </p>
      </div>
    </main>
  );
}
