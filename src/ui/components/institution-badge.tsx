// Client-safe presentational badge. The parent (server component) resolves a
// logoFilename from public/institutions/ via `resolveLogoFilename` and passes
// it in. If no filename is provided we fall back to a deterministic
// colored-initial tile.

const PALETTE_SIZE = 8;

interface Props {
  institution?: string | null;
  fallback: string;
  size?: 'sm' | 'md' | 'lg';
  /** Pre-resolved filename (e.g. 'schwab.svg'). Computed server-side. */
  logoFilename?: string | undefined;
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

function slugify(s: string): string {
  return (
    s
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .split(' ')
      .find((w) => w.length > 0) ?? ''
  );
}

export function InstitutionBadge({
  institution,
  fallback,
  size = 'md',
  logoFilename,
  className = '',
}: Props) {
  const source = (institution ?? '').trim() || fallback;

  if (logoFilename) {
    return (
      <span
        title={source}
        className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-white shadow-sm ${SIZE_CLASSES[size]} ${className}`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`/institutions/${logoFilename}`}
          alt=""
          aria-hidden
          className="h-[68%] w-[68%] object-contain"
        />
      </span>
    );
  }

  const slug = slugify(source);
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
