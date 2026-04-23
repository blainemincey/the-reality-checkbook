import { and, eq, isNotNull, sql } from 'drizzle-orm';
import { requireAuth } from '@/lib/auth/guards';
import { db } from '@/db/client';
import { accounts, creditCards } from '@/db/schema';
import { InstitutionBadge } from '@/ui/components/institution-badge';
import { getAvailableLogos, institutionSlug } from '@/ui/components/institution-logos';
import { InstitutionUploader } from './institution-uploader';

interface MergedRow {
  institution: string;
  slug: string;
  accountCount: number;
  cardCount: number;
  hasLogo: boolean;
  logoFilename: string | undefined;
}

export default async function InstitutionsSettingsPage() {
  const { user } = await requireAuth();

  // Institutions used by accounts
  const acctRows = await db
    .select({
      institution: accounts.institution,
      count: sql<number>`count(*)::int`,
    })
    .from(accounts)
    .where(and(eq(accounts.userId, user.id), isNotNull(accounts.institution)))
    .groupBy(accounts.institution);

  // Institutions used by credit cards
  const cardRows = await db
    .select({
      institution: creditCards.institution,
      count: sql<number>`count(*)::int`,
    })
    .from(creditCards)
    .where(and(eq(creditCards.userId, user.id), isNotNull(creditCards.institution)))
    .groupBy(creditCards.institution);

  // Merge by institution name (case-preserving; take the first-seen casing)
  const byInst = new Map<
    string,
    { display: string; accountCount: number; cardCount: number }
  >();
  for (const r of acctRows) {
    const name = r.institution ?? '';
    if (!name) continue;
    const key = name.toLowerCase();
    const existing = byInst.get(key);
    byInst.set(key, {
      display: existing?.display ?? name,
      accountCount: (existing?.accountCount ?? 0) + r.count,
      cardCount: existing?.cardCount ?? 0,
    });
  }
  for (const r of cardRows) {
    const name = r.institution ?? '';
    if (!name) continue;
    const key = name.toLowerCase();
    const existing = byInst.get(key);
    byInst.set(key, {
      display: existing?.display ?? name,
      accountCount: existing?.accountCount ?? 0,
      cardCount: (existing?.cardCount ?? 0) + r.count,
    });
  }

  const available = getAvailableLogos();
  const rowsWithLogo: MergedRow[] = [...byInst.values()]
    .sort((a, b) => a.display.localeCompare(b.display))
    .map((v) => {
      const slug = institutionSlug(v.display);
      return {
        institution: v.display,
        slug,
        accountCount: v.accountCount,
        cardCount: v.cardCount,
        hasLogo: available.has(slug),
        logoFilename: available.get(slug),
      };
    });

  return (
    <>
      <header className="mb-8">
        <h1 className="text-lg font-medium">Institutions</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Upload an SVG or image logo for each institution. It replaces the
          letter tile everywhere — accounts{' '}
          <em className="not-italic text-text">and</em> credit cards. Files are
          stored under{' '}
          <code className="rounded bg-canvas px-1 py-0.5 text-xs">
            public/institutions/
          </code>
          .
        </p>
      </header>

      {rowsWithLogo.length === 0 ? (
        <div className="card px-6 py-10 text-center text-sm text-text-secondary">
          No institutions yet. Set one on an account or credit card and it'll
          appear here.
        </div>
      ) : (
        <ul className="space-y-3">
          {rowsWithLogo.map((r) => (
            <li
              key={r.institution}
              className="card flex flex-wrap items-center gap-4 p-4"
            >
              <InstitutionBadge
                institution={r.institution}
                fallback={r.institution}
                size="lg"
                logoFilename={r.logoFilename}
              />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{r.institution}</div>
                <div className="mt-0.5 text-xs text-text-tertiary">
                  slug: <code>{r.slug}</code> · {describeUsage(r)}
                  {r.hasLogo && (
                    <span className="ml-2 text-credit">· logo uploaded</span>
                  )}
                </div>
              </div>
              <InstitutionUploader
                institution={r.institution}
                hasLogo={r.hasLogo}
              />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function describeUsage(r: MergedRow): string {
  const parts: string[] = [];
  if (r.accountCount > 0) {
    parts.push(`${r.accountCount} account${r.accountCount === 1 ? '' : 's'}`);
  }
  if (r.cardCount > 0) {
    parts.push(`${r.cardCount} card${r.cardCount === 1 ? '' : 's'}`);
  }
  return `used by ${parts.join(' + ')}`;
}
