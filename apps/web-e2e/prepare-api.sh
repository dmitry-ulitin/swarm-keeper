#!/bin/sh
# Recreates the e2e database, migrates and seeds it, then runs the API on port 3100.
# Started by playwright.config.ts (webServer); needs Postgres and Mailpit (pnpm infra:up, or the
# CI service containers). Schema work runs as the owner; the API runs as the application role.
set -eu
cd "$(dirname "$0")/../.."
export NODE_ENV=development
export DATABASE_OWNER_URL=postgres://swarm:swarm@127.0.0.1:5432/swarm_keeper_e2e
export DATABASE_URL=postgres://swarm_app:swarm_app@127.0.0.1:5432/swarm_keeper_e2e
export BETTER_AUTH_URL=http://localhost:4300
export PASSKEY_RP_ID=localhost
export PORT=3100
export HOST=127.0.0.1

node apps/web-e2e/prepare-db.mjs reset
pnpm --filter @swarm-keeper/api db:roles
pnpm --filter @swarm-keeper/api db:migrate
SEED_OWNER_EMAIL=owner@e2e.test SEED_OWNER_PASSWORD='e2e owner password 2026' SEED_FAMILY_NAME='Ивановы' \
  pnpm --filter @swarm-keeper/api db:seed
node apps/web-e2e/prepare-db.mjs second-family
exec node apps/api/dist/apps/api/src/main.js
