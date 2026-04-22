import { CircleCheck } from 'lucide-react';
import { requireAuth } from '@/lib/auth/guards';

export default async function ReconcilePage() {
  await requireAuth();
  return (
    <main className="mx-auto max-w-7xl px-6 py-10">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Reconcile</h1>
        <p className="mt-1.5 max-w-2xl text-sm text-text-secondary">
          Tick cleared rows against a statement, surface discrepancies, lock the set.
        </p>
      </header>
      <div className="card flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-accent-soft text-accent">
          <CircleCheck size={22} strokeWidth={1.5} />
        </div>
        <p className="text-sm text-text-secondary">
          Reconciliation UI lands in Phase 3. The data model is ready.
        </p>
      </div>
    </main>
  );
}
