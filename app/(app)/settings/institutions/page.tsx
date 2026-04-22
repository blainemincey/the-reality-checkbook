import { and, eq, isNotNull, sql } from 'drizzle-orm';
import { requireAuth } from '@/lib/auth/guards';
import { db } from '@/db/client';
import { accounts } from '@/db/schema';
import { InstitutionBadge } from '@/ui/components/institution-badge';
import { getAvailableLogos, institutionSlug } from '@/ui/components/institution-logos';
import { InstitutionUploader } from './institution-uploader';

export default async function InstitutionsSettingsPage() {
  const { user } = await requireAuth();

  const rows = await db
    .select({
      institution: accounts.institution,
      count: sql<number>`count(*)::int`,
    })
    .from(accounts)
    .where(and(eq(accounts.userId, user.id), isNotNull(accounts.institution)))
    .groupBy(accounts.institution)
    .orderBy(accounts.institution);

  const available = getAvailableLogos();
  const rowsWithLogo = rows.map((r) => {
    const slug = institutionSlug(r.institution ?? '');
    return {
      institution: r.institution ?? '',
      slug,
      count: r.count,
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
          letter tile everywhere. Files are stored under{' '}
          <code className="rounded bg-canvas px-1 py-0.5 text-xs">
            public/institutions/
          </code>{' '}
          and shared by any accounts using the same institution.
        </p>
      </header>

      {rowsWithLogo.length === 0 ? (
        <div className="card px-6 py-10 text-center text-sm text-text-secondary">
          No institutions yet. Add one to an account from{' '}
          <a href="/accounts/new" className="text-accent no-underline">
            New account
          </a>{' '}
          and it'll appear here.
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
                  slug: <code>{r.slug}.svg</code> · used by {r.count} account
                  {r.count === 1 ? '' : 's'}
                  {r.hasLogo && <span className="ml-2 text-credit">· logo uploaded</span>}
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
