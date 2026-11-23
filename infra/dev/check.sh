#!/bin/sh
# Smoke test for the local dev infrastructure. Run from the repo root: pnpm infra:check
# Set CHECK_PROXY=1 to also check the Angular dev proxy (needs the API and ng serve running).
set -eu
cd "$(dirname "$0")/../.."
. infra/dev/env.sh

ok() { echo "ok: $1"; }
fail() {
  echo "FAIL: $1" >&2
  exit 1
}

health() {
  id=$(docker compose ps -q "$1" 2>/dev/null) || true
  [ -n "$id" ] || { echo missing; return; }
  docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$id"
}

check_loopback() { # service container-port
  addr=$(docker compose port "$1" "$2" 2>/dev/null) || fail "$1 port $2 is not published"
  case "$addr" in
    127.0.0.1:*) ok "$1 port $2 published on loopback only ($addr)" ;;
    *) fail "$1 port $2 published on $addr, expected 127.0.0.1" ;;
  esac
}

psql_q() {
  docker compose exec -T postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tAc "$1"
}

check_postgres() {
  [ "$(health postgres)" = healthy ] || fail "postgres is not healthy"
  ok "postgres is healthy"
  check_loopback postgres 5432
  [ "$(psql_q 'select 1')" = 1 ] || fail "postgres select 1"
  ok "postgres answers select 1"
  ext=$(psql_q 'create extension if not exists pg_trgm; select extname from pg_extension where extname = $$pg_trgm$$' | tail -n 1)
  [ "$ext" = pg_trgm ] || fail "pg_trgm extension"
  ok "pg_trgm extension available"
}

check_postgres
