# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Self-hosted personal-finance app replacing a Google Sheets check register. Single-user (extensible to household), Docker-on-NAS deployment, all data local. v1 ships three things and nothing else: fast keyboard-first manual entry, reconciliation, and a first-class bootstrap flow for the one-time cutover from the sheet.

The `/design/plan.md` doc (if present) and `memory/project_checkregister.md` hold the full product brief — consult them before making architectural decisions.

## Commands

```bash
npm install              # install deps (or pnpm if installed — package uses pnpm lockfile format)

# dev loop
docker compose up -d db  # start Postgres in the background
npm run dev              # Next.js dev server on :3000

# tests
npm test                 # run vitest once
npm run test:watch       # watch mode

# quality gates
npm run typecheck        # tsc --noEmit
npm run lint
npm run format           # prettier --write .

# database
npm run db:generate      # emit migration SQL from schema.ts
npm run db:migrate       # apply pending migrations
npm run db:push          # push schema without a migration (dev only)
npm run db:studio        # drizzle studio UI

# single test file / test name
npx vitest run src/domain/accounts.test.ts
npx vitest run -t "backfillPreview"

# end-to-end (Playwright) — requires a throwaway Postgres
npx playwright install chromium                                # first run only
TEST_DATABASE_URL=postgres://... npm run test:e2e
```

Production bundle: `docker compose -f docker-compose.prod.yml up -d --build`.

## Architecture boundaries (don't cross these)

The project has a deliberate layering; read this before edits, especially under `src/`.

- **`src/money/`** — `Cash`, `Quantity`, `Price`. These are class wrappers around `decimal.js` with branded operations. Never use `number` or float arithmetic for monetary values anywhere — the money path uses strings end-to-end. `Cash.of(number)` throws at runtime; prefer `Cash.of('12.34')`. Scale invariants: Cash renders 4 decimals, Quantity 10, Price 6. At the API boundary, money values are transported as strings (`"1234.5600"`), not numbers.

- **`src/domain/`** — pure business logic. No DB, no React, no framework imports. Functions are deterministic and tested against hand-computed fixtures. This is where running-balance, reconciliation delta, and bootstrap preview math live.

- **`src/db/`** — Drizzle schema + postgres-js client. `schema.ts` is the single source of truth for the data model; inferred types (`AccountRow`, `TransactionRow`, etc.) are exported from it. Only `src/db/` and `src/server/` (server actions) may import Drizzle.

- **`src/server/`** — Next.js server actions grouped by domain. The only layer that translates between DB rows and domain objects. App routes in `/app` import from here, never directly from `/src/db`.

- **`src/lib/auth/`** — credentials auth. `password.ts` (argon2id via `@node-rs/argon2`) and `token.ts` are pure; `session.ts` and `cookies.ts` hit the DB / `next/headers`. High-level `auth()` in `src/lib/auth/index.ts` reads the cookie and returns `{ user, session }` for server components and actions. The session cookie carries a random token; the DB stores its SHA-256 (a DB leak does not give an attacker usable cookies). Do not introduce a framework (Lucia/Auth.js/better-auth) for single-user scope — this module is small enough to own.

- **`/app/`** — Next.js app router UI. Server components by default; client components only where required (register grid, shortcut overlay, paste parser UI).

If you find yourself putting SQL in `/src/domain` or `decimal.js` in `/app`, stop — that's a layer violation.

## Non-negotiable product invariants

These come from the product brief and must not be papered over:

- **Opening balance lives on the account row, not as a synthetic ledger transaction.** `accounts.opening_balance` and `accounts.opening_date` are the native fields. Reports, exports, running-balance, and reconciliation all reason about them directly. Do not "simplify" by inserting an "Opening Balance" row into `transactions`.

- **Transactions must be dated on or after their account's `opening_date`.** `balanceAsOf` and `registerRows` enforce this by filtering; `backfillPreview` surfaces pre-opening rows via `invalidDateCount` so the UI can flag them. If you add a new function that iterates transactions, keep this invariant.

- **Running balance formula:** `opening_balance + Σ amount for txns where txn_date ≤ asOf`. No edge cases. If the UI needs something else, it's a bug in the UI, not a reason to change the formula.

- **Backfill is a re-openable flow, not a one-shot wizard.** Settings → Backfill must always be reachable per account. Backfilled rows are structurally identical to normal rows, flagged via `is_backfill`, and editable/deletable like any other.

- **Transfers are a linked pair of opposite-signed transactions joined by a `transfers` row**, not a single transaction with from/to account fields. Each leg flows through its account's running balance naturally.

## Data model roadmap (design-for-v2)

The v1 cash schema is shaped so v2 investment accounts slot in without a painful migration:

- `accounts.account_type` already includes `brokerage` and `retirement`.
- Future tables: `securities`, `holdings_lots` (with `is_opening_position` — the equivalent of `opening_balance` for positions), `price_history`, `security_transactions`. Positions are *not* transactions: a lot owns `(quantity, cost_basis, acquired_date)` and is the unit sold against for capital gains. See `memory/project_checkregister.md` for the full rationale.

When adding cash-side changes, keep the security-side shape in mind. `amount NUMERIC(19,4)` lives on both `transactions` and future `security_transactions`, so any money-path helper must accept either.

## Design system

Light/dark pair designed together in `app/globals.css` as CSS custom properties, consumed by Tailwind via `tailwind.config.ts`. Both modes share the same perceptual warmth (canvas is warm off-white in light, warm near-black in dark — not `#FFF` or `#000`). Credit is green, debit is terracotta; both are sign+color, never color alone.

- Tabular figures: the `.amount` class and the `font-variant-numeric` rule in `globals.css` must be on every monetary cell so columns align without going monospace.
- Motion: 120ms for local state, 180ms for state transitions, single easing curve (`cubic-bezier(0.2, 0, 0, 1)`) available as `ease-swift` in Tailwind. Nothing over 220ms.
- Avoid: gradients, glass/blur, shadows deeper than `shadow-surface`, rounded-everywhere. Register rows are straight-edged; only buttons/modals round.
- Reference products: Linear, Things 3, Stripe Dashboard. Do not ship a default shadcn/Material look.

## Build phase & what's unbuilt

Phase 0 (foundation) is done: money types, domain running-balance/reconciliation/backfill, Drizzle schema, Docker, design tokens. Phase 1 (bootstrap UI) is the next and riskiest phase — paste-from-spreadsheet parser + backfill grid + opening-balance flow + Playwright end-to-end gate. Do not skip to entry or reconciliation UI without the bootstrap commit flow working.

The temporary `/app/page.tsx` landing exists so tokens + formatting render from day one. Replace it with the real account list when Phase 1 lands.
