# Hardening design (roadmap step 7)

November 24, 2026. Status: approved by the owner (November 24, 2026).

## Intent

Step 7 of the Better Auth roadmap was parked as "later" because two of its three parts wait for things that don't exist: archive tables and a deployment stack. The owner wants the parts that can be done now, done now, so the first archive table lands on a ready, tested tenancy mechanism instead of inventing it under pressure, and so nothing merges without the security tests passing.

Today:
- There is no CI (`.github/` does not exist).
- The API and the tests connect to Postgres as `swarm`, the `POSTGRES_USER` of the official image, which is a **superuser**. Superusers bypass RLS even with `FORCE ROW LEVEL SECURITY`, so any policy written today would be decorative.
- Nothing sets `app.family_id` / `app.user_id`. Permission checks already read the `member` row on every request (`MemberHasPermission`), but there is no verified family context a service or a policy can use.
- The dev proxy (`apps/web/proxy.conf.json`) passes the client's `x-forwarded-for` through, and Better Auth takes the client IP for its rate limit from that header, so a client can pick its own rate-limit bucket.

## Scope

**Goals:**
- A non-superuser application role; the API, the worker and the CLI commands connect as it. Migrations connect as the schema owner.
- The per-transaction family context: a verified `{ familyId, userId }` from the `member` row, and `FamilyDb.run(ctx, trx => …)` that opens a transaction and sets `app.family_id` / `app.user_id` locally.
- A migration helper that puts a table under the family RLS policy, tested on a probe table.
- CI on GitHub Actions: lint, typecheck, build, unit + integration tests (including the four security tests), and Playwright e2e.
- The dev proxy overwrites `x-forwarded-for`.

**Non-goals:** archive tables (`asset`, `blob`, `audit_event`…), RLS on Better Auth tables, the private-visibility rule in policies (it comes with `asset`), worker jobs, Caddy, `/.well-known/*`, the production deployment stack, oasdiff (there is no OpenAPI spec yet), Renovate/Dependabot.

**Anti-goals:** a mistake that fails open (a forgotten `run`, an unset setting, a pooled connection keeping another family's setting must all yield zero rows or an error, never another family's rows); the family id taken from `session.activeOrganizationId` without a membership check; CI that can pass with a security test skipped.

## Approaches

| | Approach | Trade-off |
| --- | --- | --- |
| **A (chosen by the owner)** | Explicit scope: a guard resolves the verified family context, `@Family()` hands it to the controller, the service calls `familyDb.run(ctx, trx => …)` | Short transactions that don't hold a connection across S3 calls; the worker uses the same `run` without HTTP; the transaction boundary is visible. Costs an explicit wrapper per service method; forgetting it fails closed |
| B | Interceptor opens a transaction per family request and keeps it in AsyncLocalStorage | Nothing to forget, less code; but the transaction spans the whole request including network calls, the worker needs a separate entry point, and the boundary is implicit |
| C | Request-scoped Nest providers | Dropped: slows every request and drags request scope through the dependency tree |

The superuser finding holds for any approach: without a separate role, RLS checks nothing.

## Decided by the owner

- Build the RLS mechanism now, together with CI and the proxy fix.
- Approach A.

## Design (builder's calls, open to correction)

### Database roles

- **Group role** `swarm_keeper_app` (`NOLOGIN NOSUPERUSER NOBYPASSRLS`). Creating roles needs `CREATEROLE`, which a schema owner on managed Postgres usually lacks, so **migrations never create roles** (builder's call). The role and its dev login come from `pnpm db:roles` (idempotent `DO` blocks, run as an admin; changed from an `infra/db/roles.sql` file during planning so dev, tests, e2e and CI need neither `psql` nor `docker compose exec`): `pnpm infra:up` runs it in dev, the API test global setup and the e2e database preparation run it, and in production the operator runs it once; `docs/architecture/backend.md` says how.
- **Grants live in migrations.** A migration grants the group role `USAGE` on the schema, `SELECT, INSERT, UPDATE, DELETE` on all current tables and usage on sequences; it fails with a clear message if the role does not exist. No `ALTER DEFAULT PRIVILEGES` (it only covers tables created later by the same role, a silent trap if another owner runs a later migration): instead `enable_family_rls(table)` also grants the group role on that table, and any non-archive table migration grants explicitly (builder's call). The group role gets no DDL rights and owns nothing. `kysely_migration*` tables are not granted.
- **Login role** for development: `swarm_app` / password `swarm_app`, `LOGIN`, member of `swarm_keeper_app`, created by the same bootstrap script. In production the operator creates their own login role in the group.
- **URLs:** `DATABASE_URL` is the application role (dev default `postgres://swarm_app:swarm_app@127.0.0.1:5432/swarm_keeper`). New `DATABASE_OWNER_URL` is the schema owner (dev default the current `swarm` URL), used by `db:migrate`, `db:migrate:down`, `db:types` and the test/e2e database reset + migration. Both are required in production. `.env.example`, `infra/dev/env.sh` and `CLAUDE.md` get the new variable.
- **Who uses which:** API, worker, `db:seed` and `family:*` use `DATABASE_URL` (they only touch Better Auth tables, which the group role can write). Migrations and codegen use the owner.
- **Startup check:** at boot the API (and later the worker) runs `select rolsuper, rolbypassrls from pg_roles where rolname = current_user`; if either is true it refuses to start with a clear error, unless `NODE_ENV` is `development` (logs a warning). Tests assert the role is clean.

### Family context

- `FamilyContext = { familyId: string; userId: string }` in `apps/api/src/database` (it belongs with the connection; any module may import it).
- `FamilyContextGuard` in `identity`: after the global auth guard, reads the session's user id and active family id, then loads the `member` row for that pair. No row → 403 `FORBIDDEN` (same answer as today). With a row it stores `{ familyId: member.organizationId, userId: member.userId }` on the request. `RequirePermission` adds this guard, so every family route gets it; it runs before `TwoFactorGuard`.
- `@Family()` param decorator returns the stored context, and throws (500) if the route has no `RequirePermission`: a programming error, not a client error.
- Ordering: the role check by `MemberHasPermission` and the context load are two reads of the same row in one request. A member removed between them gets a 403 from the guard; that is the safe side. Merging them into one read is left for later.

### FamilyDb

- `FamilyDb` provider in `apps/api/src/database`, exported through its `index.ts`: `run<T>(ctx: FamilyContext, fn: (trx: Transaction<DB>) => Promise<T>): Promise<T>`.
- It opens `db.transaction()`, first runs `select set_config('app.family_id', $1, true), set_config('app.user_id', $2, true)` (`set_config(..., true)` is `SET LOCAL` with parameters), then calls `fn`. The settings vanish at commit/rollback, so a pooled connection carries nothing to the next user.
- It validates both ids as UUIDs before sending them (defense in depth; they come from our own rows).
- Nested `run` is not supported: `fn` gets `trx`, and code inside passes `trx` along.

### RLS helper

- `enable_family_rls(table regclass)`, a SQL function created by a migration (changed from a TS helper during implementation: Node loads migrations as plain `.ts` and they cannot import from `src`). It `enable`s and `force`s row level security on the table, creates policy `family_isolation` `using (family_id = nullif(current_setting('app.family_id', true), '')::uuid)` with the same `with check`, and grants the group role data access to the table. An unset setting yields `null`, which matches no row and fails every insert. `execute` is revoked from `public`.
- `CLAUDE.md` gains the rule: every archive table migration calls `select enable_family_rls('<table>')`.

### Tests (integration, against the test database, never skipped)

On a probe table (`rls_probe(id, family_id, note)`) created by the test through the owner connection with `enable_family_rls`, then used through the application role:
- outside `run`, the app role sees zero rows and cannot insert;
- inside `run` for family A it sees only A's rows, and inserting a row with B's `family_id` fails;
- after `run` for A finishes, the same pooled connection (pool size 1) sees nothing outside `run`, and `run` for B sees only B;
- the connected role is neither superuser nor `BYPASSRLS`.

Through HTTP with a test controller using `@RequirePermission` + `@Family()`:
- the context comes from the membership row; a session whose `activeOrganizationId` points to a family without membership gets 403;
- a member removed mid-session gets 403 (existing test, extended to the new guard).

### CI

- `.github/workflows/ci.yml`, on `pull_request` and on `push` to `main`.
- Job `check`: Node 26, pnpm 12 (version from `packageManager`), `pnpm install --frozen-lockfile`, `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm test`. Service containers: `postgres:18.7-alpine` (user `swarm`, database `swarm_keeper`) and `axllent/mailpit:v1.34.0`, the same images as `compose.yaml`. Garage is not needed yet (no test touches S3).
- Job `e2e`: same services, Playwright Chromium, `pnpm e2e`; uploads the Playwright report on failure.
- Skipped tests: lint fails on `.skip`, `.only` and `.todo` in spec files (an ESLint rule over `*.spec.ts`), so a security test cannot be silently disabled.
- Making the jobs required checks on `main` is a GitHub setting; the owner turns it on (or approves doing it with `gh api`).
- A Better Auth update arrives as a PR like any other, so it runs the same gate.

### Dev proxy

- `apps/web/proxy.conf.json` becomes `proxy.conf.mjs`: it sets `x-forwarded-for` to the socket's remote address on every proxied request, replacing whatever the client sent. `angular.json` points at it.
- `apps/web-e2e/proxy.e2e.json` stays a pass-through on purpose: the e2e scenarios pick a client IP per context to stay in separate rate-limit buckets. A comment there says it is test-only.
- The header rewrite is a small exported function in the proxy config, unit-tested (a spoofed header is replaced by the socket address). No end-to-end check in `infra:check` (builder's call): the API exposes the client IP only behind a session, and a dev-only echo endpoint would be new surface.

### Docs to update in the same change

- `docs/architecture/backend.md`: the two roles, `DATABASE_OWNER_URL`, `FamilyDb.run`, `enable_family_rls`, the startup check.
- `CLAUDE.md`: the new variable, the migration rule, CI.
- The roadmap: step 7 split, with what remains (Caddy, `/.well-known/*`) waiting for the deployment stack.

### Existing code that moves to the owner connection

- Tests that change the schema (the trigger in `passkey-sign-up.spec.ts`, the probe table) use `DATABASE_OWNER_URL`.
- The e2e database preparation (`apps/web-e2e` `prepare-api.sh`) stops using `docker compose exec psql`, which has no counterpart when Postgres is a CI service container; it resets, migrates and runs the roles script through the owner URL from Node or a host `psql`.

## Left to the builder

- Exact ESLint rule for skipped tests (`no-restricted-properties` or the Vitest plugin).
- How the dev proxy reads the remote address under Angular 22's Vite-based dev server; check the option names against the installed version.
- Whether the probe-table tests live in `apps/api/src/database` or `identity`.
