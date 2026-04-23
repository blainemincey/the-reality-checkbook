# Check Register

Self-hosted personal-finance app. Docker on home server/NAS.

## Quick start (development)

```bash
cp .env.example .env
# edit .env — at minimum set DATABASE_URL and SESSION_SECRET

npm install
./scripts/dev.sh start   # postgres (brew) + Next dev server on :3000
./scripts/dev.sh status  # see what's up
./scripts/dev.sh stop    # stop dev server; add --all to stop postgres too
```

First-time user:

```bash
./scripts/dev.sh migrate   # apply schema against DATABASE_URL
npm run create-user        # prompts for email + password
```

## Tests

```bash
npm test                   # vitest unit suite
./scripts/dev.sh test      # Playwright e2e against a local throwaway postgres
```

## Production (home server / NAS)

External Postgres — set `DATABASE_URL` + `SESSION_SECRET` in `.env` and:

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

Required env in `.env`:

```bash
DATABASE_URL=postgres://user:pass@your-postgres-host:5432/dbname
SESSION_SECRET=$(openssl rand -base64 32)
APP_PORT=3000                 # optional, host port to expose
```

**At container start** the entrypoint applies any pending migrations against
`DATABASE_URL` before the server binds :3000. The migrator uses drizzle-orm's
programmatic runner — no drizzle-kit in the production image.

**First run** — create the initial admin user from the host once the DB is
migrated. From your dev machine with `DATABASE_URL` set:

```bash
npm run create-user    # interactive; first user auto-admins
```

**Uploaded logos** persist via a bind mount at `./public/institutions/` on
the host. Logos you commit to that directory are visible inside the
container; new uploads from the UI land on the host filesystem.

## Image

```bash
docker build -t mincey-finances:latest .
docker run -d --name mff \
  -p 3000:3000 \
  -e DATABASE_URL=postgres://... \
  -e SESSION_SECRET=... \
  -v $(pwd)/public/institutions:/app/public/institutions \
  mincey-finances:latest
```

## Project docs

- `CLAUDE.md` — architecture + invariants for contributors (and Claude Code).
