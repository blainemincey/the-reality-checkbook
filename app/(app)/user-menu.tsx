'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { ChevronDown, LogOut, Settings, Users } from 'lucide-react';
import { logoutAction } from '../login/actions';

interface Props {
  email: string;
  role: 'admin' | 'user';
  initials: string;
}

export function UserMenu({ email, role, initials }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-full border border-transparent bg-chrome-border/40 px-1.5 py-1 text-xs text-chrome-text transition-colors duration-120 ease-swift hover:bg-chrome-border/70"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-accent text-[11px] font-semibold text-[#04140A]">
          {initials}
        </span>
        <span className="hidden flex-col leading-tight sm:flex">
          <span className="text-[11px]">{email}</span>
          {role === 'admin' && (
            <span className="text-[9px] uppercase tracking-wider text-chrome-muted">
              admin
            </span>
          )}
        </span>
        <ChevronDown
          width={14}
          height={14}
          strokeWidth={2}
          className={`text-chrome-muted transition-transform duration-120 ease-swift ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-20 mt-2 w-56 overflow-hidden rounded-lg border border-border bg-surface shadow-card"
        >
          <div className="border-b border-border px-3 py-2.5">
            <div className="truncate text-xs text-text">{email}</div>
            <div className="mt-0.5 text-[10px] uppercase tracking-wider text-text-tertiary">
              {role}
            </div>
          </div>
          <ul className="py-1 text-sm">
            <li>
              <Link
                href="/settings/institutions"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2 px-3 py-1.5 text-text-secondary transition-colors duration-120 ease-swift hover:bg-surface-elevated hover:text-text"
              >
                <Settings width={14} height={14} strokeWidth={2} />
                Settings
              </Link>
            </li>
            {role === 'admin' && (
              <li>
                <Link
                  href="/settings/users"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2 px-3 py-1.5 text-text-secondary transition-colors duration-120 ease-swift hover:bg-surface-elevated hover:text-text"
                >
                  <Users width={14} height={14} strokeWidth={2} />
                  Manage users
                </Link>
              </li>
            )}
          </ul>
          <div className="border-t border-border">
            <form action={logoutAction}>
              <button
                type="submit"
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-text-secondary transition-colors duration-120 ease-swift hover:bg-surface-elevated hover:text-debit"
              >
                <LogOut width={14} height={14} strokeWidth={2} />
                Sign out
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
