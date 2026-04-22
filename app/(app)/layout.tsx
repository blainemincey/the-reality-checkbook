import Link from 'next/link';
import { requireAuth } from '@/lib/auth/guards';
import { logoutAction } from '../login/actions';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { user } = await requireAuth();

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-3">
          <Link
            href="/"
            className="text-sm font-medium tracking-tight text-text no-underline"
          >
            check register
          </Link>
          <div className="flex items-center gap-4">
            <span className="text-xs text-text-tertiary">{user.email}</span>
            <form action={logoutAction}>
              <button
                type="submit"
                className="text-xs text-text-secondary transition-colors duration-120 ease-swift hover:text-text"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>
      <div className="flex-1">{children}</div>
    </div>
  );
}
