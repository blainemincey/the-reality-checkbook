# syntax=docker/dockerfile:1.7
#
# Multi-stage build. Final image ships:
#   - Next standalone server (app + traced prod deps)
#   - Runtime migrator (scripts/docker-migrate.mjs + src/db/migrations)
#   - Entrypoint that applies migrations before starting the server
#
# Expects an external Postgres via DATABASE_URL at runtime.

# ---- deps: install production node_modules (npm ci from lockfile) ----------
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
# --ignore-scripts skips @node-rs/argon2's postinstall (prebuilt binaries are
# picked up at runtime); we avoid running arbitrary scripts from transitive deps.
RUN npm ci --ignore-scripts

# ---- build: compile Next (standalone output) ------------------------------
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ---- runtime: minimal image to run the server -----------------------------
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
RUN addgroup -g 1001 -S app && adduser -S -u 1001 -G app app

# Next standalone output: self-contained server + traced node_modules
COPY --from=builder --chown=app:app /app/.next/standalone ./
COPY --from=builder --chown=app:app /app/.next/static ./.next/static
COPY --from=builder --chown=app:app /app/public ./public

# Next's output tracer occasionally pulls .env files from the build context
# into the standalone output. .dockerignore should prevent them reaching the
# builder, but we scrub for safety so no build-time secrets ship.
RUN rm -f ./.env ./.env.local ./.env.*.local ./.env.development ./.env.production ./.env.test

# Migrator deps. Next's standalone tracer bundles drizzle-orm + postgres into
# webpack chunks instead of leaving them in node_modules, so a separate Node
# process running the migrator can't import them from there. Add them
# explicitly. Both packages have no hard runtime dependencies so copying the
# two directories is sufficient.
COPY --from=deps --chown=app:app /app/node_modules/drizzle-orm ./node_modules/drizzle-orm
COPY --from=deps --chown=app:app /app/node_modules/postgres ./node_modules/postgres

# Runtime migrator + migration SQL files
COPY --chown=app:app scripts/docker-migrate.mjs ./scripts/docker-migrate.mjs
COPY --chown=app:app src/db/migrations ./migrations

# Entrypoint: migrations, then `node server.js`.
COPY --chown=app:app scripts/docker-entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

USER app
EXPOSE 3000
ENTRYPOINT ["/app/entrypoint.sh"]
