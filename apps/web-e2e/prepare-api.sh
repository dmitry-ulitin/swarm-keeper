#!/bin/sh
# Recreates the e2e database, migrates and seeds it, then runs the API on port 3100.
# Started by playwright.config.ts (webServer); needs `pnpm infra:up`.
set -eu
cd "$(dirname "$0")/../.."
export NODE_ENV=development
export DATABASE_URL=postgres://swarm:swarm@127.0.0.1:5432/swarm_keeper_e2e
export BETTER_AUTH_URL=http://localhost:4300
export PASSKEY_RP_ID=localhost
export PORT=3100
export HOST=127.0.0.1

psql() { docker compose exec -T postgres psql -v ON_ERROR_STOP=1 -U swarm "$@"; }
psql -d postgres -c 'drop database if exists swarm_keeper_e2e with (force)' -c 'create database swarm_keeper_e2e'
pnpm --filter @swarm-keeper/api db:migrate
SEED_OWNER_EMAIL=owner@e2e.test SEED_OWNER_PASSWORD='e2e owner password 2026' SEED_FAMILY_NAME='Ивановы' \
  pnpm --filter @swarm-keeper/api db:seed
# A second family with the same owner (regular users cannot create families).
psql -d swarm_keeper_e2e <<'SQL'
with family as (
  insert into organization (name, slug, created_at) values ('Петровы', 'petrovy', now()) returning id
)
insert into member (organization_id, user_id, role, created_at)
select family.id, u.id, 'owner', now() from family, "user" u where u.email = 'owner@e2e.test';
SQL
exec node apps/api/dist/apps/api/src/main.js
