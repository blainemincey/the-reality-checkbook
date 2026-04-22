'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

interface Props {
  href: string;
  label: string;
  icon: ReactNode;
  matchPrefix?: string;
}

export function NavPill({ href, label, icon, matchPrefix }: Props) {
  const pathname = usePathname() ?? '/';
  const active =
    (matchPrefix && pathname.startsWith(matchPrefix)) ||
    (href === '/' ? pathname === '/' : pathname.startsWith(href));

  return (
    <Link
      href={href}
      className={
        'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors duration-120 ease-swift ' +
        (active
          ? 'bg-accent text-[#04140A]'
          : 'text-chrome-muted hover:bg-chrome-border/50 hover:text-chrome-text')
      }
    >
      {icon}
      {label}
    </Link>
  );
}
