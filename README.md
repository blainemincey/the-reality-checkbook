# Check Register

Self-hosted personal-finance app. Docker on home server/NAS.

## Quick start (development)

```bash
cp .env.example .env
# edit .env — at minimum set POSTGRES_PASSWORD and SESSION_SECRET

npm install
docker compose up -d db
npm run db:push     # first-time schema push
npm run dev         # http://localhost:3000
```

## Tests

```bash
npm test            # one-shot
npm run test:watch
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
