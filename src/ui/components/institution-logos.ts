// Server-only helpers for resolving institution brand logos. The badge
// component itself is client-safe; it takes a filename string as a prop. These
// helpers run on the server to look that filename up from public/institutions/.

import { readdirSync } from 'node:fs';
import path from 'node:path';
import { cache } from 'react';

const LOGO_EXT_RE = /\.(svg|png|jpe?g|webp|gif)$/i;

export const getAvailableLogos = cache((): Map<string, string> => {
  try {
    const dir = path.join(process.cwd(), 'public', 'institutions');
    const entries = readdirSync(dir).filter((f) => LOGO_EXT_RE.test(f));
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

/**
 * Given an institution name (or fallback), return the logo filename under
 * public/institutions/ if one exists, else undefined. Use from server
 * components only.
 */
export function resolveLogoFilename(
  institution: string | null | undefined,
  fallback: string,
): string | undefined {
  const source = (institution ?? '').trim() || fallback;
  const slug = institutionSlug(source);
  if (!slug) return undefined;
  return getAvailableLogos().get(slug);
}
