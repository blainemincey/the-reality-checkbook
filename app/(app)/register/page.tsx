import { ArrowLeftRight } from 'lucide-react';
import { requireAuth } from '@/lib/auth/guards';

export default async function RegisterPage() {
  await requireAuth();
  return (
    <main className="mx-auto max-w-7xl px-6 py-10">
      <StubHeader
        title="Register"
        subtitle="Cross-account chronological ledger with a combined running balance — the spreadsheet view."
      />
      <ComingSoon icon={ArrowLeftRight} />
    </main>
  );
}

function StubHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <header className="mb-8">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-1.5 max-w-2xl text-sm text-text-secondary">{subtitle}</p>
    </header>
  );
}

function ComingSoon({ icon: Icon }: { icon: typeof ArrowLeftRight }) {
  return (
    <div className="card flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-accent-soft text-accent">
        <Icon size={22} strokeWidth={1.5} />
      </div>
      <p className="text-sm text-text-secondary">Coming in a later pass. Nothing here yet.</p>
    </div>
  );
}
