#!/usr/bin/env bash
# Lifecycle for local dev services: Postgres (brew) and Next dev server.
# One command each, so you don't have to remember brew/npm/lsof invocations.
#
#   scripts/dev.sh start        start postgres (if needed) + dev server
#   scripts/dev.sh stop         stop the dev server
#   scripts/dev.sh stop --all   also stop postgres
#   scripts/dev.sh restart      stop then start
#   scripts/dev.sh status       state of each service + remote db reachability
#   scripts/dev.sh logs         tail dev server log
#   scripts/dev.sh test [...]   run the Playwright e2e gate on the test db
#   scripts/dev.sh migrate      drizzle migrate against DATABASE_URL (.env)
#
# Production (NAS) uses Docker Compose; see docker-compose.prod.yml.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

PID_FILE="$REPO_ROOT/.dev.pid"
LOG_FILE="$REPO_ROOT/.dev.log"
PG_FORMULA="postgresql@16"
PG_BIN="/opt/homebrew/opt/$PG_FORMULA/bin"
TEST_DB="checkregister_test"
DEV_PORT="${APP_PORT:-3000}"

if [[ -t 1 ]]; then
  c_reset=$'\033[0m'; c_dim=$'\033[2m'; c_bold=$'\033[1m'
  c_green=$'\033[0;32m'; c_yellow=$'\033[0;33m'; c_red=$'\033[0;31m'
else
  c_reset=''; c_dim=''; c_bold=''; c_green=''; c_yellow=''; c_red=''
fi

msg()  { printf "%s\n" "$*" >&2; }
ok()   { printf "%s\n" "${c_green}✓${c_reset} $*" >&2; }
warn() { printf "%s\n" "${c_yellow}!${c_reset} $*" >&2; }
err()  { printf "%s\n" "${c_red}✗${c_reset} $*" >&2; }

load_env() {
  if [[ -f "$REPO_ROOT/.env" ]]; then
    set -a
    # shellcheck disable=SC1091
    . "$REPO_ROOT/.env"
    set +a
  fi
}

ensure_pg_bin() {
  if [[ -d "$PG_BIN" ]]; then
    export PATH="$PG_BIN:$PATH"
  fi
}

pg_state() {
  brew services list 2>/dev/null \
    | awk -v f="$PG_FORMULA" '$1==f {print $2; exit}'
}

port_pid() {
  lsof -iTCP:"$1" -sTCP:LISTEN -nP -t 2>/dev/null | head -1
}

dev_pid() {
  [[ -f "$PID_FILE" ]] || return 1
  local pid
  pid=$(cat "$PID_FILE")
  if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
    printf "%s" "$pid"
    return 0
  fi
  rm -f "$PID_FILE"
  return 1
}

wait_pg_ready() {
  local deadline=$((SECONDS + 15))
  until pg_isready -h 127.0.0.1 -p 5432 -q 2>/dev/null; do
    if (( SECONDS >= deadline )); then
      err "postgres did not become ready in 15s"
      return 1
    fi
    sleep 0.5
  done
}

ensure_test_db() {
  if ! psql -h 127.0.0.1 -lqt 2>/dev/null | cut -d'|' -f1 | tr -d ' ' | grep -qw "$TEST_DB"; then
    createdb -h 127.0.0.1 "$TEST_DB"
    DATABASE_URL="postgres://$(whoami)@127.0.0.1:5432/$TEST_DB" \
      npm run db:migrate --silent >/dev/null
    ok "created test db $TEST_DB (migrated)"
  fi
}

cmd_start() {
  ensure_pg_bin

  local state
  state=$(pg_state)
  if [[ "$state" == "started" ]]; then
    ok "postgres already running"
  else
    msg "starting postgres…"
    brew services start "$PG_FORMULA" >/dev/null
    wait_pg_ready
    ok "postgres started"
  fi

  if dev_pid >/dev/null; then
    ok "dev server already running (pid $(dev_pid))"
    return 0
  fi

  if [[ -n "$(port_pid "$DEV_PORT")" ]]; then
    err "port $DEV_PORT already in use by pid $(port_pid "$DEV_PORT") — not ours; aborting"
    return 1
  fi

  msg "starting dev server… (logs: .dev.log)"
  load_env
  : > "$LOG_FILE"
  # nohup + background + disown so it survives this shell.
  nohup npm run dev >> "$LOG_FILE" 2>&1 &
  local pid=$!
  echo "$pid" > "$PID_FILE"
  disown "$pid" 2>/dev/null || true

  local deadline=$((SECONDS + 60))
  until [[ -n "$(port_pid "$DEV_PORT")" ]]; do
    if ! kill -0 "$pid" 2>/dev/null; then
      err "dev server died — check .dev.log"
      rm -f "$PID_FILE"
      return 1
    fi
    if (( SECONDS >= deadline )); then
      err "dev server didn't bind :$DEV_PORT in 60s — check .dev.log"
      return 1
    fi
    sleep 0.5
  done
  ok "dev server listening on http://127.0.0.1:$DEV_PORT"
}

cmd_stop() {
  local opt="${1:-}"

  if dev_pid >/dev/null; then
    local pid
    pid=$(dev_pid)
    msg "stopping dev server (pid $pid)…"
    pkill -P "$pid" 2>/dev/null || true
    kill "$pid" 2>/dev/null || true
    local deadline=$((SECONDS + 5))
    while kill -0 "$pid" 2>/dev/null && (( SECONDS < deadline )); do sleep 0.25; done
    if kill -0 "$pid" 2>/dev/null; then kill -9 "$pid" 2>/dev/null || true; fi
    rm -f "$PID_FILE"
    ok "dev server stopped"
  else
    warn "dev server not running"
  fi

  # Belt-and-braces: if the port is still bound (orphaned child), knock it off.
  local lingering
  lingering=$(port_pid "$DEV_PORT" || true)
  if [[ -n "$lingering" ]]; then
    warn "port $DEV_PORT still bound by pid $lingering — killing"
    kill "$lingering" 2>/dev/null || true
  fi

  if [[ "$opt" == "--all" ]]; then
    local state
    state=$(pg_state)
    if [[ "$state" == "started" ]]; then
      msg "stopping postgres…"
      brew services stop "$PG_FORMULA" >/dev/null
      ok "postgres stopped"
    else
      warn "postgres not running"
    fi
  fi
}

cmd_restart() {
  cmd_stop
  cmd_start
}

cmd_status() {
  ensure_pg_bin
  load_env

  printf "%s\n" "${c_bold}local${c_reset}"
  local state
  state=$(pg_state)
  case "$state" in
    started)
      ok "postgres  ${c_dim}$PG_FORMULA on :5432${c_reset}"
      ;;
    stopped|error)
      err "postgres  ${c_dim}$state${c_reset}"
      ;;
    '')
      warn "postgres  ${c_dim}not installed via brew${c_reset}"
      ;;
    *)
      warn "postgres  ${c_dim}$state${c_reset}"
      ;;
  esac

  if [[ "$state" == "started" ]]; then
    if psql -h 127.0.0.1 -lqt 2>/dev/null | cut -d'|' -f1 | tr -d ' ' | grep -qw "$TEST_DB"; then
      ok "test db   ${c_dim}$TEST_DB exists${c_reset}"
    else
      warn "test db   ${c_dim}$TEST_DB missing (run: scripts/dev.sh test, or createdb $TEST_DB)${c_reset}"
    fi
  fi

  if dev_pid >/dev/null; then
    local pid port_bound
    pid=$(dev_pid)
    port_bound=$(port_pid "$DEV_PORT" || true)
    if [[ "$port_bound" == "$pid" || -n "$port_bound" ]]; then
      ok "dev       ${c_dim}pid $pid on :$DEV_PORT${c_reset}"
    else
      warn "dev       ${c_dim}pid $pid alive but :$DEV_PORT not bound yet${c_reset}"
    fi
  else
    err "dev       ${c_dim}stopped${c_reset}"
  fi

  printf "\n%s\n" "${c_bold}remote (DATABASE_URL)${c_reset}"
  if [[ -z "${DATABASE_URL:-}" ]]; then
    warn "DATABASE_URL not set (no .env?)"
  else
    local host port
    host=$(printf "%s" "$DATABASE_URL" | sed -n 's|.*@\([^:/]*\).*|\1|p')
    port=$(printf "%s" "$DATABASE_URL" | sed -n 's|.*@[^:/]*:\([0-9][0-9]*\).*|\1|p')
    port=${port:-5432}
    if [[ -n "$host" ]] && nc -zv -w 2 "$host" "$port" >/dev/null 2>&1; then
      ok "remote db ${c_dim}$host:$port reachable${c_reset}"
    else
      err "remote db ${c_dim}${host:-?}:${port} unreachable${c_reset}"
    fi
  fi
}

cmd_logs() {
  if [[ ! -f "$LOG_FILE" ]]; then
    warn "no log file at $LOG_FILE yet — dev server hasn't been started"
    exit 0
  fi
  exec tail -f "$LOG_FILE"
}

cmd_test() {
  ensure_pg_bin

  if [[ "$(pg_state)" != "started" ]]; then
    msg "starting postgres for tests…"
    brew services start "$PG_FORMULA" >/dev/null
    wait_pg_ready
  fi
  ensure_test_db

  # Playwright's webServer runs `npm run build` which clobbers .next. If the
  # dev server is running against the same .next, it hits ENOENT on
  # _buildManifest mid-request. Stop dev before the gate, restart after.
  local dev_was_running=0
  if dev_pid >/dev/null; then
    dev_was_running=1
    msg "pausing dev server for the test run…"
    cmd_stop
    rm -rf "$REPO_ROOT/.next"
  fi

  local rc=0
  TEST_DATABASE_URL="postgres://$(whoami)@127.0.0.1:5432/$TEST_DB" \
    npm run test:e2e -- "$@" || rc=$?

  if (( dev_was_running )); then
    rm -rf "$REPO_ROOT/.next"
    msg "restarting dev server…"
    cmd_start
  fi

  return $rc
}

cmd_migrate() {
  load_env
  if [[ -z "${DATABASE_URL:-}" ]]; then
    err "DATABASE_URL not set — check .env"
    return 1
  fi
  npm run db:migrate
}

usage() {
  cat <<'EOF'
Lifecycle for local dev services: Postgres (brew) and Next dev server.

  scripts/dev.sh start        start postgres (if needed) + dev server
  scripts/dev.sh stop         stop the dev server
  scripts/dev.sh stop --all   also stop postgres
  scripts/dev.sh restart      stop then start
  scripts/dev.sh status       state of each service + remote db reachability
  scripts/dev.sh logs         tail dev server log
  scripts/dev.sh test [...]   run the Playwright e2e gate on the test db
  scripts/dev.sh migrate      drizzle migrate against DATABASE_URL (.env)

Production (NAS) uses Docker Compose; see docker-compose.prod.yml.
EOF
}

main() {
  case "${1:-}" in
    start)    shift || true; cmd_start   "$@" ;;
    stop)     shift || true; cmd_stop    "$@" ;;
    restart)  shift || true; cmd_restart "$@" ;;
    status)   shift || true; cmd_status  "$@" ;;
    logs)     shift || true; cmd_logs    "$@" ;;
    test)     shift || true; cmd_test    "$@" ;;
    migrate)  shift || true; cmd_migrate "$@" ;;
    ''|-h|--help) usage ;;
    *) usage; exit 2 ;;
  esac
}

main "$@"
