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

## Production (home server)

```bash
cp .env.example .env && $EDITOR .env
docker compose -f docker-compose.prod.yml up -d --build
```

The `backup` sidecar runs `scripts/backup.sh` (age-encrypted `pg_dump`) into `./backups/`. Set `AGE_RECIPIENT` to your age public key before relying on it.

## Restore test

```bash
AGE_IDENTITY=/path/to/age.key \
DATABASE_URL=postgres://... \
./scripts/restore.sh ./backups/checkregister-YYYYMMDD.pgdump.age
```

## Project docs

- `CLAUDE.md` — architecture + invariants for contributors (and Claude Code).
