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

check_garage() {
  [ "$(health garage)" = healthy ] || fail "garage is not healthy"
  ok "garage is healthy"
  check_loopback garage 3900
  tmp=$(mktemp -d)
  trap 'rm -rf "$tmp"' EXIT
  echo "roundtrip $(date +%s)" > "$tmp/in.txt"
  key="s3://$S3_BUCKET/check/roundtrip.txt"
  # Go through this stack's published host port, the same path the API uses.
  endpoint="http://$(docker compose port garage 3900)"
  docker run --rm --network host -v "$tmp:/work" -w /work \
    -e AWS_ACCESS_KEY_ID="$S3_ACCESS_KEY_ID" -e AWS_SECRET_ACCESS_KEY="$S3_SECRET_ACCESS_KEY" \
    -e AWS_DEFAULT_REGION="$S3_REGION" --entrypoint sh amazon/aws-cli:2.42.1 -c "
      set -e
      aws --endpoint-url $endpoint s3 cp in.txt $key --only-show-errors
      aws --endpoint-url $endpoint s3 cp $key out.txt --only-show-errors
      aws --endpoint-url $endpoint s3 rm $key --only-show-errors
    " || fail "S3 round trip through bucket $S3_BUCKET"
  cmp -s "$tmp/in.txt" "$tmp/out.txt" || fail "S3 object content differs after round trip"
  ok "S3 round trip through bucket $S3_BUCKET at $endpoint"
}

check_proxy() {
  body=$(curl -s --max-time 5 http://localhost:4200/api/v1/health) || fail "dev server on :4200 is not reachable"
  [ "$body" = '{"status":"ok"}' ] || fail "ng serve does not proxy /api to the API (got: $(echo "$body" | head -c 60))"
  ok "ng serve proxies /api to the API"
}

check_postgres
check_garage
if [ "${CHECK_PROXY:-0}" = 1 ]; then check_proxy; fi
