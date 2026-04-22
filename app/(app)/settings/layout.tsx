import Link from 'next/link';
import { requireAuth } from '@/lib/auth/guards';

export default async function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAuth();
  return (
    <main className="mx-auto grid max-w-6xl grid-cols-1 gap-8 px-6 py-10 md:grid-cols-[13rem_1fr]">
      <nav className="md:sticky md:top-10 md:self-start">
        <p className="mb-3 text-xs uppercase tracking-wider text-text-tertiary">Settings</p>
        <ul className="space-y-0.5 text-sm">
          <li>
            <Link
              href="/settings/institutions"
              className="block rounded px-2 py-1.5 text-text-secondary transition-colors duration-120 ease-swift hover:bg-canvas hover:text-text"
            >
              Institutions
            </Link>
          </li>
        </ul>
      </nav>
      <section>{children}</section>
    </main>
  );
}
