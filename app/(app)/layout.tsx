import Link from 'next/link';
import {
  LayoutDashboard,
  ArrowLeftRight,
  CreditCard,
  LineChart,
} from 'lucide-react';
import { requireAuth } from '@/lib/auth/guards';
import { personInitials } from '@/lib/username';
import { NavPill } from './nav-pill';
import { UserMenu } from './user-menu';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { user } = await requireAuth();
  const initials = personInitials(user.name, user.username);

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
              Mincey Family Finances
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
                href="/settings/credit-cards"
                label="Credit cards"
                icon={<CreditCard width={13} height={13} strokeWidth={2} />}
              />
              <NavPill
                href="/reports"
                label="Reports"
                icon={<LineChart width={13} height={13} strokeWidth={2} />}
              />
            </nav>
          </div>
          <UserMenu
            username={user.username}
            name={user.name}
            role={user.role}
            initials={initials}
          />
        </div>
      </header>
      <div className="flex-1">{children}</div>
    </div>
  );
}
