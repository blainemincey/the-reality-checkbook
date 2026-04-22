#!/bin/sh
# Restore a pgdump.age backup into a fresh database.
#
# Usage:
#   AGE_IDENTITY=/path/to/key.txt ./scripts/restore.sh /backups/checkregister-YYYY...age
#
# Requires age and psql/pg_restore on the host.

set -eu

FILE="${1:-}"
if [ -z "$FILE" ] || [ ! -f "$FILE" ]; then
  echo "Usage: AGE_IDENTITY=<key> $0 <backup.pgdump.age>"
  exit 2
fi
if [ -z "${AGE_IDENTITY:-}" ]; then
  echo "AGE_IDENTITY not set (path to your age secret key)."
  exit 2
fi
if [ -z "${DATABASE_URL:-}" ]; then
  echo "DATABASE_URL not set (target database to restore into)."
  exit 2
fi

TMP=$(mktemp -t cr-restore.XXXXXX)
trap 'rm -f "$TMP"' EXIT

age -d -i "$AGE_IDENTITY" -o "$TMP" "$FILE"
pg_restore --clean --if-exists --no-owner --no-privileges -d "$DATABASE_URL" "$TMP"

echo "Restore complete. Running integrity check…"
psql "$DATABASE_URL" -c "SELECT count(*) AS transactions FROM transactions;"
psql "$DATABASE_URL" -c "SELECT name, opening_balance FROM accounts ORDER BY created_at;"
