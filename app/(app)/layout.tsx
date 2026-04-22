import Link from 'next/link';
import { requireAuth } from '@/lib/auth/guards';
import { logoutAction } from '../login/actions';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { user } = await requireAuth();

  return (
    <div className="flex min-h-screen flex-col">
      <header className="bg-chrome text-chrome-text">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <Link
            href="/"
            className="flex items-center gap-2 text-sm font-semibold tracking-tight no-underline"
          >
            <span className="inline-block h-2 w-2 rounded-full bg-accent shadow-[0_0_12px_rgb(var(--color-accent)/0.6)]" />
            Check Register
          </Link>
          <div className="flex items-center gap-4">
            <span className="text-xs text-chrome-muted">
              {user.email}
              {user.role === 'admin' && (
                <span className="ml-2 rounded border border-chrome-border px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-chrome-muted">
                  admin
                </span>
              )}
            </span>
            <form action={logoutAction}>
              <button
                type="submit"
                className="text-xs text-chrome-muted transition-colors duration-120 ease-swift hover:text-chrome-text"
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
