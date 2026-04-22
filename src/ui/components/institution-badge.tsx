// A small square marker for an account's institution.
//
//  1. If public/institutions/<slug>.svg exists, render that logo on a neutral
//     tile. Slug is the first alphanumeric run of the normalized institution
//     name ("Charles Schwab" → "charles"; drop a file at
//     public/institutions/charles.svg to match).
//  2. Otherwise, render a letter tile colored by a deterministic hash over
//     the slug — same name always yields the same hue.
//
// We deliberately don't ship brand logos in the repo. Owners drop their own
// SVGs in public/institutions/ and the module-load scan picks them up at
// server start.
//
// Server-only: uses fs.readdirSync at module load. If you end up rendering
// the badge from a client component, lift the logo check up to a server
// component and pass down `logoSlug` as a prop.

import { readdirSync } from 'node:fs';
import path from 'node:path';
import { cache } from 'react';

const PALETTE_SIZE = 8;

const LOGO_EXT_RE = /\.(svg|png|jpe?g|webp|gif)$/i;

// Map of slug → actual filename (including extension). React.cache dedupes
// per-request; new uploads/imports appear on the next request with no server
// restart. If multiple extensions exist for the same slug, the latest one
// wins (svg-then-png ordering is platform-specific; we prefer svg).
export const getAvailableLogos = cache((): Map<string, string> => {
  try {
    const dir = path.join(process.cwd(), 'public', 'institutions');
    const entries = readdirSync(dir).filter((f) => LOGO_EXT_RE.test(f));
    // Prefer SVG when both exist for the same slug
    entries.sort((a, b) => {
      const aSvg = a.toLowerCase().endsWith('.svg') ? 1 : 0;
      const bSvg = b.toLowerCase().endsWith('.svg') ? 1 : 0;
      return bSvg - aSvg;
    });
    const map = new Map<string, string>();
    for (const f of entries) {
      const base = f.replace(LOGO_EXT_RE, '').toLowerCase();
      if (!map.has(base)) map.set(base, f);
    }
    return map;
  } catch {
    return new Map();
  }
});

export function institutionSlug(source: string): string {
  return (
    source
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .split(' ')
      .find((w) => w.length > 0) ?? ''
  );
}

interface Props {
  institution?: string | null;
  fallback: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZE_CLASSES = {
  sm: 'h-7 w-7 text-xs',
  md: 'h-9 w-9 text-sm',
  lg: 'h-11 w-11 text-base',
} as const;

function hashToIndex(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = (h << 5) + h + s.charCodeAt(i);
  return (h >>> 0) % PALETTE_SIZE;
}

function firstInitial(s: string): string {
  const trimmed = s.trim();
  if (!trimmed) return '·';
  for (const ch of trimmed) {
    if (/[\p{L}]/u.test(ch)) return ch.toUpperCase();
  }
  return trimmed[0]!.toUpperCase();
}

export function InstitutionBadge({
  institution,
  fallback,
  size = 'md',
  className = '',
}: Props) {
  const source = (institution ?? '').trim() || fallback;
  const slug = institutionSlug(source);
  const available = getAvailableLogos();
  const filename = slug ? available.get(slug) : undefined;

  if (filename) {
    return (
      <span
        title={source}
        className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-white shadow-sm ${SIZE_CLASSES[size]} ${className}`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`/institutions/${filename}`}
          alt=""
          aria-hidden
          className="h-[68%] w-[68%] object-contain"
        />
      </span>
    );
  }

  const index = hashToIndex(slug || fallback);
  const initial = firstInitial(source);
  const style = {
    backgroundColor: `rgb(var(--badge-${index}) / 0.14)`,
    color: `rgb(var(--badge-${index}))`,
  } as React.CSSProperties;

  return (
    <span
      aria-hidden
      title={source}
      style={style}
      className={`inline-flex shrink-0 items-center justify-center rounded-md font-semibold tracking-tight ${SIZE_CLASSES[size]} ${className}`}
    >
      {initial}
    </span>
  );
}
