// A small colored tile carrying the institution's first letter. The color is
// deterministic per normalized institution name (same Schwab → same amber
// every time), pulled from an 8-entry palette defined in globals.css so both
// themes share the same perceptual weight.
//
// We intentionally do NOT ship brand logos — licensing aside, a grid of
// official bank logos reads like a SaaS settings page. A letter tile stays
// consistent across any institution the user adds, including ones that don't
// exist yet.

interface Props {
  institution?: string | null;
  fallback: string; // usually the account name — used when institution is empty
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZE_CLASSES = {
  sm: 'h-7 w-7 text-xs',
  md: 'h-8 w-8 text-sm',
  lg: 'h-10 w-10 text-base',
} as const;

const PALETTE_SIZE = 8;

function hashToIndex(s: string): number {
  // djb2 — fast, good distribution for short strings
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = (h << 5) + h + s.charCodeAt(i);
  return (h >>> 0) % PALETTE_SIZE;
}

function firstInitial(s: string): string {
  const trimmed = s.trim();
  if (!trimmed) return '·';
  // Skip non-letter leading chars ("$", "+", etc.)
  for (const ch of trimmed) {
    if (/[\p{L}]/u.test(ch)) return ch.toUpperCase();
  }
  return trimmed[0]!.toUpperCase();
}

function normalize(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .find((w) => w.length > 0) ?? '';
}

export function InstitutionBadge({
  institution,
  fallback,
  size = 'md',
  className = '',
}: Props) {
  const source = (institution ?? '').trim() || fallback;
  const key = normalize(source) || fallback;
  const index = hashToIndex(key);
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
