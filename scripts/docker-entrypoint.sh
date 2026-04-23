#!/bin/sh
# Container entrypoint: apply pending migrations, then start the server.
# Both share the same DATABASE_URL / SESSION_SECRET from the container env.

set -e

echo "[entrypoint] running migrations…"
node /app/scripts/docker-migrate.mjs

echo "[entrypoint] starting app on :${PORT:-3000}"
exec node /app/server.js
