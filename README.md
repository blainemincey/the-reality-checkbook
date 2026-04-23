# Mincey Family Finances

A self-hosted personal/household finance app — check register, cross-account
unified ledger, credit-card tracking, and a dashboard over it all. Built for
a home-server/NAS deployment, talks to your own Postgres, nothing phones home.

## Feature snapshot

- **Multi-account check registers** — add transactions fast, inline-edit
  anything, toggle cleared state with a click, delete with a confirm. Keyboard-
  friendly entry (⌘⏎ saves). Payment/Deposit columns match spreadsheet muscle
  memory.
- **Cross-account unified ledger** (`/register`) — every transaction across
  every account, chronologically interleaved, with a single combined running
  balance column. Filter per-account + paginate.
- **Overview dashboard** — net balance, deposits/payments MTD, cleared %,
  uncleared count with oldest-pending hint, top payee MTD, active payees MTD,
  credit balance. Balance-over-time area chart and per-account sparklines.
- **Reports** — monthly cashflow bar chart (deposits / payments / net), top
  income sources and top spending payees side-by-side, spending-by-type
  horizontal bar breakdown. Single period selector (3 / 6 / 12 months or all
  time) drives every section.
- **Bootstrap flow** — paste a TSV/CSV export from any spreadsheet, heuristic
  column detection (date/payee/amount/memo/check#/category), live preview of
  the resulting balance before you commit.
- **Credit cards** — simple amount-owed tracking with auto-timestamped updates,
  rolled up to the dashboard's Credit stat card. Separate from the ledger
  because you don't log every CC charge.
- **Payees** — configurable list with autocomplete in entry + create-on-enter.
- **Institutions** — upload an SVG/PNG/JPEG/WebP/GIF logo or import from URL.
  Applies to every account and every credit card using the same institution.
- **Users** — username-based login (not email), admin role, household support,
  login count + last-login tracking, inline rename/role-swap/password reset.
- **Recharts** for balance trends and account sparklines, all dark-first.

## Tech

| Layer | Pick |
|---|---|
| Framework | Next.js 15 (App Router, Server Actions, Turbopack dev) |
| Language | TypeScript (strict), React 19 |
| Styling | Tailwind CSS, hand-tuned dark-only tokens |
| ORM / schema | Drizzle + `drizzle-kit` migrations |
| Database | Postgres 16 (external — you bring it) |
| Money | `decimal.js` wrappers — `Cash` (NUMERIC(19,4)), `Quantity`
(NUMERIC(28,10)), `Price` (NUMERIC(19,6)), no floats in the money path |
| Auth | Custom argon2id + SHA-256 session cookies (no Lucia, no NextAuth) |
| Tests | Vitest (unit), Playwright (e2e gate) |
| Icons | lucide-react |
| Charts | Recharts |
| Deploy | Multi-stage Dockerfile, runtime migrations via `drizzle-orm/migrator` |

## Project structure

```
app/                        Next.js App Router
  (app)/                    Authenticated shell + pages
    accounts/[id]/          Per-account register, entry, backfill, settings
    register/               Cross-account unified ledger
    settings/               Institutions, payees, credit cards, users
  login/                    Login form + action
src/
  db/schema.ts              Single source of truth for the data model
  db/migrations/            Generated SQL migrations
  domain/                   Pure business logic: running-balance, unified
                            ledger, charts, paste parser, backfill preview
  money/                    Cash / Quantity / Price types + format/parse
  lib/auth/                 Password hash, session tokens, guards
  server/                   Server actions + DB-facing helpers
  ui/components/            Shared presentational components
scripts/
  dev.sh                    Local dev lifecycle (postgres + next dev)
  docker-entrypoint.sh      Container entrypoint (migrate → serve)
  docker-migrate.mjs        Runtime migrator (drizzle-orm programmatic)
  create-user.ts            First-user CLI / promote / reset
  import-xlsx.ts            One-shot spreadsheet importer
  backup.sh / restore.sh    Age-encrypted pg_dump helpers
```

## Local development

Requires Node 20+, Docker not required.

```bash
cp .env.example .env      # fill in DATABASE_URL + SESSION_SECRET
npm install
./scripts/dev.sh start    # starts local postgres + next dev on :3000
./scripts/dev.sh status   # state of postgres, test db, dev server, remote db
./scripts/dev.sh stop     # stop dev server; --all to stop postgres too
```

First-run:

```bash
./scripts/dev.sh migrate  # apply schema against DATABASE_URL
npm run create-user       # prompts for username + password (first user
                          # auto-admins)
```

## Tests

```bash
npm test                  # vitest (~85 tests across money, domain, auth)
./scripts/dev.sh test     # Playwright e2e against a local throwaway postgres
npx tsc --noEmit          # typecheck
```

The Playwright gate runs the full bootstrap narrative: login → create account
→ paste 12 TSV rows → verify preview → commit → verify register balance.

## Production deployment

External Postgres, Docker Compose:

```bash
cat > .env <<'EOF'
DATABASE_URL=postgres://user:pass@your-postgres-host:5432/dbname
SESSION_SECRET=$(openssl rand -base64 32)
APP_PORT=3000
EOF

docker compose -f docker-compose.prod.yml up -d --build
```

At container start the entrypoint runs pending migrations before the server
binds. No drizzle-kit in the production image — the migrator uses
`drizzle-orm`'s programmatic runner.

**Create your first admin user** (from a dev machine with `DATABASE_URL` set):

```bash
npm run create-user
```

**Updates:**

```bash
git pull
docker compose -f docker-compose.prod.yml up -d --build
```

Uploaded institution logos persist via a bind mount at
`./public/institutions/` on the host.

## Data model highlights

- `accounts` — cash/checking/savings, each with a native `opening_balance` and
  `opening_date`. Running balance = opening + Σ transactions ≤ asOf. No
  synthetic "opening balance" transactions.
- `transactions` — signed `amount NUMERIC(19,4)`, `kind` enum for the
  user-facing type (`bill_pay`, `check`, `atm`, `deposit`, `interest`, …),
  `cleared_state` two-value boolean-ish (uncleared/cleared), `payee_id` FK to
  `payees`, soft-delete via `is_deleted`, optional `reconciliation_id` FK for
  future Phase 3 work.
- `credit_cards` — separate from accounts because we track amount-owed only
  (no individual CC transactions). Auto-stamps `last_updated_at` on amount
  change.
- `users` — username (3–32 chars, `[a-z0-9._-]`), optional display name,
  role (admin/user), `login_count` + `last_login_at`.
- `payees` — per-user deduplicated list; `transactions.payee_id` FK.

## License

Private.
