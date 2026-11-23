# Local development infrastructure design

November 23, 2026. Status: approved.

## Intent

One command brings up the database and object storage needed for local development, so the next tasks (Better Auth, database access, uploads) have real services to talk to. This is for development only: whether Swarm Keeper ships a self-hosted Compose stack is undecided, so nothing here aims at production.

## Scope

**Goals:** PostgreSQL and S3-compatible storage in Docker Compose; idempotent storage bootstrap; root scripts to start, stop, reset and tail them; environment variables in `.env.example`; the Angular dev server proxying `/api` to the API so web and API share one origin.

**Non-goals:** images for api, worker or web; Caddy, HTTPS, production config; Mailpit (comes with Better Auth); media tools for the worker (ffmpeg, exiftool, ocrmypdf); Playwright.

## Approaches

| | Approach | Trade-off |
| --- | --- | --- |
| **A (chosen)** | Compose runs only infrastructure; apps run on the host via `pnpm` with hot reload; the Angular dev proxy gives one origin. | Fast daily loop, no deployment decisions. The worker's media tools must later be installed on the host or the worker moved into a container. |
| B | A plus Caddy in Compose in front of host-run apps. | Closer to production (one domain, `/.well-known/*`, second rate-limit layer), but an extra moving part needed only with Better Auth and the native app, and a step toward self-hosting. |
| C | Everything in containers, apps with bind-mounted hot reload. | One command for all, worker gets its tools; bind-mount hot reload is slow on WSL and `node_modules` must live in the container. |

## Design

- **`compose.yaml`** at the repo root, project name `swarm-keeper-dev`.
  - `postgres`: `postgres:18.7-alpine` (not 19.0: a fresh major is a needless risk for an archive whose dev version tends to become production), database `swarm_keeper`, healthcheck `pg_isready`.
  - `garage`: `dxflrs/garage:v2.5.0`, single node, config `infra/dev/garage.toml`, S3 API on 3900, region `garage`, healthcheck via the `garage` CLI.
  - Ports bound to `127.0.0.1` only. Data in named volumes (Postgres on WSL bind mounts has permission problems).
- **`infra/dev/garage-init.sh`**, idempotent: assigns the node layout, imports the dev key with the fixed id and secret from the environment, creates bucket `swarm-keeper`, grants the key read/write/owner.
- **Root scripts:** `infra:up` (`docker compose up -d --wait`, then the init script), `infra:down`, `infra:reset` (down with volumes), `infra:logs`.
- **Environment:** `.env.example` gains `DATABASE_URL`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`. Compose reads `.env` and falls back to dev defaults when it is absent. All values are dev-only.
- **Angular:** `apps/web/proxy.conf.json` forwards `/api` to `http://localhost:3000`; `ng serve` uses it.
- **Docs:** a "Local infrastructure" section in `CLAUDE.md`.

## Verification

- After `pnpm infra:up` both services are `healthy`.
- `psql` answers `select 1` and can create extension `pg_trgm`.
- An object can be written to and read back from bucket `swarm-keeper` through the S3 API with the dev key.
- Running `pnpm infra:up` a second time succeeds.
- With the API running, `ng serve` answers `/api/v1/health` on port 4200.

## Builder's calls

- Exact Garage CLI commands and `garage.toml` keys are checked against the v2.5.0 docs.
- The S3 round-trip check may use an `aws-cli` container or a small script.
