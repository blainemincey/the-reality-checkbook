import Link from 'next/link';
import {
  LayoutDashboard,
  ArrowLeftRight,
  CircleCheck,
  LineChart,
  Settings,
} from 'lucide-react';
import { requireAuth } from '@/lib/auth/guards';
import { logoutAction } from '../login/actions';
import { NavPill } from './nav-pill';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { user } = await requireAuth();
  const initials =
    user.email
      .split('@')[0]!
      .split(/[._-]+/)
      .map((s) => s[0]?.toUpperCase() ?? '')
      .join('')
      .slice(0, 2) || '??';

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-chrome-border bg-chrome">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-6">
          <div className="flex items-center gap-6">
            <Link
              href="/"
              className="flex items-center gap-2 py-4 text-sm font-semibold tracking-tight text-chrome-text no-underline"
            >
              <span className="inline-block h-2 w-2 rounded-full bg-accent shadow-[0_0_12px_rgb(var(--color-accent)/0.6)]" />
              Check Register
            </Link>
            <nav className="hidden items-center gap-1 md:flex">
              <NavPill
                href="/"
                label="Overview"
                icon={<LayoutDashboard width={13} height={13} strokeWidth={2} />}
              />
              <NavPill
                href="/register"
                label="Register"
                icon={<ArrowLeftRight width={13} height={13} strokeWidth={2} />}
              />
              <NavPill
                href="/reconcile"
                label="Reconcile"
                icon={<CircleCheck width={13} height={13} strokeWidth={2} />}
              />
              <NavPill
                href="/reports"
                label="Reports"
                icon={<LineChart width={13} height={13} strokeWidth={2} />}
              />
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/settings/institutions"
              className="hidden items-center gap-1.5 rounded-full px-3 py-1.5 text-xs text-chrome-muted transition-colors duration-120 ease-swift hover:bg-chrome-border/50 hover:text-chrome-text md:inline-flex"
            >
              <Settings width={13} height={13} strokeWidth={2} />
              Settings
            </Link>
            <div className="flex items-center gap-2">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-accent text-[11px] font-semibold text-[#04140A]">
                {initials}
              </span>
              <div className="hidden flex-col leading-tight sm:flex">
                <span className="text-[11px] text-chrome-text">{user.email}</span>
                {user.role === 'admin' && (
                  <span className="text-[9px] uppercase tracking-wider text-chrome-muted">
                    admin
                  </span>
                )}
              </div>
            </div>
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
