# Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make RLS real (a non-superuser application role, a verified family context, `FamilyDb.run`, a migration helper for policies), gate every merge with CI, and stop the dev proxy from forwarding a client-chosen `x-forwarded-for`.

**Architecture:** Migrations and codegen connect as the schema owner (`DATABASE_OWNER_URL`); the API, worker and CLI connect as a login role in group `swarm_keeper_app` (`DATABASE_URL`). A guard turns the session into a `FamilyContext` from the `member` row; services wrap family work in `FamilyDb.run(ctx, trx => …)`, which sets `app.family_id` / `app.user_id` with `set_config(…, true)`. Archive tables get policy `family_isolation` through `familyRls(table)`.

**Tech Stack:** NestJS 12, Kysely + `pg`, PostgreSQL 18, Vitest, Playwright, GitHub Actions, Angular 22 dev server (Vite).

**Spec:** `docs/superpowers/specs/2026-11-24-hardening-design.md`

## Global Constraints

- Group role name `swarm_keeper_app`, `NOLOGIN NOSUPERUSER NOBYPASSRLS`; dev login `swarm_app` / password `swarm_app`, member of the group.
- Migrations never create roles. Roles come from `pnpm db:roles` (deviation from the spec's `infra/db/roles.sql`: a TS command runs the same idempotent SQL without `docker compose exec` or a host `psql`, in dev, tests, e2e and CI alike; Task 1 updates the spec).
- Dev defaults: `DATABASE_URL=postgres://swarm_app:swarm_app@127.0.0.1:5432/swarm_keeper`, `DATABASE_OWNER_URL=postgres://swarm:swarm@127.0.0.1:5432/swarm_keeper`. Both required when `NODE_ENV=production`.
- Settings are `app.family_id` and `app.user_id`, set only via `set_config(name, value, true)`.
- Policy name `family_isolation`, expression `family_id = nullif(current_setting('app.family_id', true), '')::uuid`, as both `using` and `with check`; tables get `enable` and `force row level security`.
- No `ALTER DEFAULT PRIVILEGES`. `kysely_migration` and `kysely_migration_lock` are never granted to the group.
- Error responses stay `{ code, params }`; a missing membership answers 403 `FORBIDDEN` as today.
- CI uses the same images as `compose.yaml`: `postgres:18.7-alpine`, `axllent/mailpit:v1.34.0`. Node 26, pnpm from `packageManager` (`pnpm@12.14.0`).
- Every new file, comment and doc is in English; commits are Conventional Commits ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **`fn` throws inside `run`** → the transaction rolls back and the next query on that pooled connection sees no family. Test in Task 3.
2. **Session without an active family** (`activeOrganizationId` null) on a `@RequirePermission` route → 403, not 500 from `@Family()`. Test in Task 4.
3. **Insert inside `run` with `family_id` null or omitted** → rejected by `with check`. Test in Task 3.
4. **A developer's existing dev database** after pulling: `pnpm infra:up` creates the roles, `pnpm db:migrate` grants; if the role is missing the grants migration fails with a message naming `pnpm db:roles`. Test in Task 1.
5. **Production start as a superuser or `BYPASSRLS` role** → the API and worker refuse to boot; in `development` they only warn. Test in Task 2.

---

### Task 1: Application role and two connection URLs

**Files:**
- Create: `apps/api/src/database/app-role.ts`, `apps/api/src/database/app-role.spec.ts`, `apps/api/src/db-roles.ts` (CLI entry), migration `apps/api/migrations/<ts>_app_role_grants.ts` (via `pnpm db:new app_role_grants`)
- Modify: `apps/api/src/database/database-url.ts` (+ spec), `apps/api/src/database/create-database.ts`, `apps/api/src/database/index.ts`, `apps/api/test/global-setup.ts`, `apps/api/vitest.config.ts`, `apps/api/kysely.config.ts`, `apps/api/package.json` (`db:types`, new `db:roles`), root `package.json` (`db:roles`, `infra:up` runs it after Garage init), `apps/api/src/modules/identity/testing.ts`, `apps/api/src/modules/identity/passkey-sign-up.spec.ts` (trigger via owner), `.env.example`, `infra/dev/env.sh`, `CLAUDE.md`, `docs/architecture/backend.md`, the spec (roles line)

**Interfaces:**
- Produces:
  - `APP_ROLE = 'swarm_keeper_app'`, `DEV_APP_LOGIN = { user: 'swarm_app', password: 'swarm_app' }`
  - `ensureAppRoles(db: Kysely<any>, options: { devLogin: boolean }): Promise<void>` — creates the group (and the dev login with `in role swarm_keeper_app` when `devLogin`) if missing; idempotent.
  - `assertAppRoleExists(db: Kysely<any>, role?: string): Promise<void>` — throws `Error` whose message contains `pnpm db:roles` when the role is missing; used by the grants migration.
  - `DEV_DATABASE_URL` (now `swarm_app`), `DEV_DATABASE_OWNER_URL` (the old `swarm` URL), `databaseOwnerUrl(env = process.env): string` (same rules as `databaseUrl`, variable `DATABASE_OWNER_URL`).
  - `createDatabase(url: string, options?: { max?: number }): Kysely<DB>`
  - `ownerDatabase(): Database` in `identity/testing.ts` (test-only, from `DATABASE_OWNER_URL`), for tests that run DDL.

- [ ] **Step 1: Write the failing tests** in `database-url.spec.ts` and `app-role.spec.ts`

```ts
it('defaults the owner URL to the swarm superuser in development', () => {
  expect(databaseOwnerUrl({})).toBe('postgres://swarm:swarm@127.0.0.1:5432/swarm_keeper');
  expect(databaseUrl({})).toBe('postgres://swarm_app:swarm_app@127.0.0.1:5432/swarm_keeper');
});
it('requires DATABASE_OWNER_URL in production', () => {
  expect(() => databaseOwnerUrl({ NODE_ENV: 'production' })).toThrow(/DATABASE_OWNER_URL/);
});

// app-role.spec.ts, against the test database
it('connects the tests as the application login, not the owner', async () => {
  const { rows } = await sql<{ u: string }>`select current_user as u`.execute(appDb);
  expect(rows[0].u).toBe('swarm_app');
});
it('is idempotent', async () => {
  await ensureAppRoles(ownerDb, { devLogin: true });
  await ensureAppRoles(ownerDb, { devLogin: true });
});
it('lets the application role use Better Auth tables but not the migration table', async () => {
  await appDb.selectFrom('user').select('id').limit(1).execute();
  await expect(sql`select * from kysely_migration`.execute(appDb)).rejects.toThrow(/permission denied/);
});
it('names pnpm db:roles when the role is missing', async () => {
  await expect(assertAppRoleExists(ownerDb, 'no_such_role')).rejects.toThrow(/pnpm db:roles/);
});
```

- [ ] **Step 2: Run** `pnpm --filter @swarm-keeper/api test -- database` — Expected: FAIL (`databaseOwnerUrl` / `ensureAppRoles` not defined).

- [ ] **Step 3: Implement**
  - `app-role.ts`: `DO $$ … if not exists (select from pg_roles where rolname = …) then create role … end if $$`. The dev password is a constant, so inline SQL is fine; role names go through `sql.id`/literal constants only.
  - Grants migration: `up` calls `assertAppRoleExists`, then `grant usage on schema public`, `grant select, insert, update, delete on all tables in schema public`, `revoke all on kysely_migration, kysely_migration_lock`, `grant usage, select on all sequences in schema public`. `down` revokes the same. Import `assertAppRoleExists` from `../src/database/app-role.js` directly (not the barrel, same eslint-disable pattern as `kysely.config.ts`).
  - `global-setup.ts`: owner URL (`DATABASE_OWNER_URL` from `project.config.env`) for drop/create; `ensureAppRoles(admin, { devLogin: true })` on the maintenance connection; migrate through the owner URL of the test database. Keep the `TEST_DATABASE_NAME` guard on both URLs.
  - `vitest.config.ts` env: `DATABASE_URL: testDatabaseUrl(databaseUrl())`, `DATABASE_OWNER_URL: testDatabaseUrl(databaseOwnerUrl())`.
  - `kysely.config.ts` → `databaseOwnerUrl()`. `db:types` → `${DATABASE_OWNER_URL:-postgres://swarm:swarm@127.0.0.1:5432/swarm_keeper}`.
  - `db-roles.ts`: owner URL, `devLogin = NODE_ENV === 'development'`; scripts `db:roles` in api (`pnpm build && NODE_ENV=${NODE_ENV:-development} node dist/apps/api/src/db-roles.js`) and root. `infra:up` appends `&& pnpm db:roles`.
  - `passkey-sign-up.spec.ts`: create/drop the trigger and function through `ownerDatabase()`, destroyed in `afterAll`.
  - Docs: `.env.example` and `infra/dev/env.sh` get both URLs; `CLAUDE.md` commands (`db:roles`, `db:migrate` uses `DATABASE_OWNER_URL`, `db:types` too) and a line that the API connects as `swarm_app`; `backend.md` gets a "Database roles" subsection (owner vs `swarm_keeper_app`, how an operator creates a login in the group: `create role <login> login password '…' in role swarm_keeper_app`, run `pnpm db:roles` once as an admin); the spec's "Group role" bullet now names `pnpm db:roles` instead of `infra/db/roles.sql`.

- [ ] **Step 4: Run** `pnpm --filter @swarm-keeper/api test` — Expected: all API tests PASS as `swarm_app`. Then `pnpm db:roles && pnpm db:migrate` against the dev database and `pnpm db:types` — Expected: `schema.ts` unchanged (`git diff --exit-code apps/api/src/database/schema.ts`).

- [ ] **Step 5: Commit** `feat(api): application database role and owner connection for migrations`

### Task 2: Refuse to boot with an RLS-bypassing role

**Files:**
- Create: `apps/api/src/database/check-database-role.ts`, `apps/api/src/database/check-database-role.spec.ts`
- Modify: `apps/api/src/database/database.module.ts`, `apps/api/src/database/index.ts`

**Interfaces:**
- Consumes: `ownerDatabase()` (Task 1).
- Produces: `checkDatabaseRole(db: Database, env?: NodeJS.ProcessEnv, logger?: Pick<Logger, 'warn'>): Promise<void>` — reads `rolsuper, rolbypassrls` for `current_user`; if either is true, throws `Error` mentioning `swarm_keeper_app`, except when `NODE_ENV === 'development'`, where it warns. `DatabaseModule` calls it in `onApplicationBootstrap`.

- [ ] **Step 1: Write the failing tests**

```ts
it('accepts the application role', async () => {
  await expect(checkDatabaseRole(appDb, { NODE_ENV: 'production' })).resolves.toBeUndefined();
});
it('refuses a superuser outside development', async () => {
  await expect(checkDatabaseRole(ownerDb, { NODE_ENV: 'production' })).rejects.toThrow(/swarm_keeper_app/);
  await expect(checkDatabaseRole(ownerDb, { NODE_ENV: 'test' })).rejects.toThrow();
});
it('only warns about a superuser in development', async () => {
  const warn = vi.fn();
  await checkDatabaseRole(ownerDb, { NODE_ENV: 'development' }, { warn });
  expect(warn).toHaveBeenCalledOnce();
});
```

- [ ] **Step 2: Run** `pnpm --filter @swarm-keeper/api test -- check-database-role` — Expected: FAIL (module not found).
- [ ] **Step 3: Implement** `checkDatabaseRole` and the `onApplicationBootstrap` hook.
- [ ] **Step 4: Run** `pnpm --filter @swarm-keeper/api test && pnpm --filter @swarm-keeper/worker test` — Expected: PASS.
- [ ] **Step 5: Commit** `feat(api): refuse to start as a role that bypasses RLS`

### Task 3: `familyRls` and `FamilyDb.run`

**Files:**
- Create: `apps/api/src/database/family-rls.ts`, `apps/api/src/database/family-db.ts`, `apps/api/src/database/family-db.spec.ts`
- Modify: `apps/api/src/database/database.module.ts` (provide + export `FamilyDb`), `apps/api/src/database/index.ts`, `CLAUDE.md` (invariant: every archive table migration calls `familyRls`), `docs/architecture/backend.md`

**Interfaces:**
- Consumes: `createDatabase(url, { max })`, `ownerDatabase()`, `APP_ROLE` (Task 1).
- Produces:
  - `type FamilyContext = { familyId: string; userId: string }`
  - `familyRls(table: string): RawBuilder<unknown>[]` and `dropFamilyRls(table: string): RawBuilder<unknown>[]` — for migrations; `familyRls` also grants `select, insert, update, delete` on the table to `swarm_keeper_app`. No Nest imports in this file (migrations import it directly).
  - `@Injectable() class FamilyDb { run<T>(ctx: FamilyContext, fn: (trx: Transaction<DB>) => Promise<T>): Promise<T> }` — throws `Error` before opening a transaction if either id is not a UUID.

- [ ] **Step 1: Write the failing tests** in `family-db.spec.ts`. `beforeAll`: through `ownerDatabase()` create `rls_probe (id uuid default uuidv7() primary key, family_id uuid, note text)` and execute `familyRls('rls_probe')`; insert one row for family A and one for B as owner (superuser bypasses). `afterAll`: drop the table. `FamilyDb` is constructed over an app-role connection with `{ max: 1 }`; probe queries use `sql` (the table is not in `DB`).

```ts
it('shows nothing and accepts nothing outside run', async () => {
  expect(await count(appDb)).toBe(0);
  await expect(insert(appDb, A)).rejects.toThrow(/row-level security/);
});
it('shows only the family of the context', async () => {
  expect(await familyDb.run(ctxA, (trx) => notes(trx))).toEqual(['a']);
});
it('rejects a row for another family or without one', async () => {
  await expect(familyDb.run(ctxA, (trx) => insert(trx, B))).rejects.toThrow(/row-level security/);
  await expect(familyDb.run(ctxA, (trx) => insert(trx, null))).rejects.toThrow(/row-level security/);
});
it('leaves nothing on the pooled connection, after commit or after a throw', async () => {
  await familyDb.run(ctxA, (trx) => notes(trx));
  expect(await count(appDb)).toBe(0);
  await expect(familyDb.run(ctxA, async () => { throw new Error('boom'); })).rejects.toThrow('boom');
  expect(await count(appDb)).toBe(0);
  expect(await familyDb.run(ctxB, (trx) => notes(trx))).toEqual(['b']);
});
it('sets app.user_id', async () => {
  expect(await familyDb.run(ctxA, (trx) => currentSetting(trx, 'app.user_id'))).toBe(ctxA.userId);
});
it('refuses an id that is not a UUID', async () => {
  await expect(familyDb.run({ familyId: 'x', userId: ctxA.userId }, (trx) => notes(trx))).rejects.toThrow();
});
```

- [ ] **Step 2: Run** `pnpm --filter @swarm-keeper/api test -- family-db` — Expected: FAIL (module not found).
- [ ] **Step 3: Implement** `family-rls.ts` (policy text exactly as in Global Constraints) and `FamilyDb` (`db.transaction().execute`, first statement `select set_config('app.family_id', ${familyId}, true), set_config('app.user_id', ${userId}, true)`).
- [ ] **Step 4: Run** `pnpm --filter @swarm-keeper/api test` — Expected: PASS.
- [ ] **Step 5: Commit** `feat(api): FamilyDb.run and the family RLS policy helper`

### Task 4: Verified family context for routes

**Files:**
- Create: `apps/api/src/modules/identity/family-context.ts` (guard + `@Family()`), `apps/api/src/modules/identity/family-context.spec.ts`
- Modify: `apps/api/src/modules/identity/require-permission.ts` (`UseGuards(FamilyContextGuard, TwoFactorGuard)`), `apps/api/src/modules/identity/index.ts` (export `Family`)

**Interfaces:**
- Consumes: `FamilyContext`, `FamilyDb` (Task 3); `startAuthApp`, `createFamily`, `createMember`, `sessionFor`, `clientIp` from `testing.ts`.
- Produces: `FamilyContextGuard` (loads `member` by session user id + `session.activeOrganizationId`; no row or no active family → `ForbiddenException({ code: 'FORBIDDEN', params: {} })`; stores `request.familyContext`), `Family()` param decorator (returns `FamilyContext`; throws `InternalServerErrorException` when `request.familyContext` is missing).

- [ ] **Step 1: Write the failing tests** with a test controller `GET /test/family` (`@RequirePermission('asset', 'read')`, returns `@Family()`) and `GET /test/unguarded` (no `RequirePermission`, uses `@Family()`).

```ts
it('takes the family from the membership row', async () => {
  const res = await get('/test/family', await sessionFor(auth, db, user.id, family.familyId)).expect(200);
  expect(res.body).toEqual({ familyId: family.familyId, userId: user.id });
});
it('answers 403 when the active family has no membership', async () => {
  const other = await createFamily(db);
  await get('/test/family', await sessionFor(auth, db, user.id, other.familyId)).expect(403);
});
it('answers 403, not 500, without an active family', async () => {
  await get('/test/family', await sessionFor(auth, db, user.id, null)).expect(403);
});
it('answers 403 after the member is removed, in the same session', async () => { /* delete member row, expect 403 */ });
it('is a server error to use @Family() without RequirePermission', async () => {
  await get('/test/unguarded', authorization).expect(500);
});
```

  Check first whether `MemberHasPermission` already answers 403 for the null-family and no-membership cases; the tests pin the outcome either way.

- [ ] **Step 2: Run** `pnpm --filter @swarm-keeper/api test -- family-context` — Expected: FAIL.
- [ ] **Step 3: Implement** the guard and decorator; read the session the way `me.controller.ts` does (`session.session.activeOrganizationId`).
- [ ] **Step 4: Run** `pnpm --filter @swarm-keeper/api test` — Expected: PASS, including `require-permission.spec.ts`.
- [ ] **Step 5: Commit** `feat(api): family context from the verified membership`

### Task 5: E2E database preparation without docker exec

**Files:**
- Create: `apps/web-e2e/prepare-db.ts` (run with `node`, which strips types on Node 26)
- Modify: `apps/web-e2e/prepare-api.sh`, `apps/web-e2e/env.ts`, `apps/web-e2e/support/api.ts`

**Interfaces:**
- Produces: `env.ts` exports `DATABASE_OWNER_URL` (`postgres://swarm:swarm@127.0.0.1:5432/swarm_keeper_e2e`, used by `support/api.ts` and `prepare-db.ts`) and `DATABASE_URL` (`postgres://swarm_app:swarm_app@…/swarm_keeper_e2e`, for the API).

- [ ] **Step 1: Implement** `prepare-db.ts`: via `pg` on the `postgres` database (owner) drop + create `swarm_keeper_e2e`. `prepare-api.sh` then runs `pnpm db:roles` and `db:migrate` with `DATABASE_OWNER_URL`, `db:seed` with the app `DATABASE_URL`, then `node prepare-db.ts --second-family` (the existing "Петровы" insert, as owner), then starts the API with the app URL. Every value from `env.ts` or the script's exports; no `docker compose` left in the file.
- [ ] **Step 2: Run** `pnpm e2e` — Expected: all scenarios PASS in `chromium-en` and `chromium-ru`; `grep -c 'docker' apps/web-e2e/prepare-api.sh` prints `0`.
- [ ] **Step 3: Commit** `test(web-e2e): prepare the database through the owner URL`

### Task 6: Dev proxy overwrites x-forwarded-for

**Files:**
- Create: `apps/web/proxy.conf.mjs`, `apps/web/proxy.conf.spec.ts` (or the project's existing unit-test location for plain TS; the web app runs tests through `ng test`)
- Delete: `apps/web/proxy.conf.json`
- Modify: `apps/web/angular.json` (`proxyConfig`), `apps/web-e2e/proxy.e2e.json` stays; add a `"//"` comment key or a sibling README line saying it passes the header on purpose (test-only)

**Interfaces:**
- Produces: `export function forwardClientIp(proxyReq: { setHeader(name: string, value: string): void }, req: { socket: { remoteAddress?: string } }): void` and the default export `{ '/api': { target: 'http://localhost:3000', secure: false, configure: (proxy) => proxy.on('proxyReq', forwardClientIp) } }`. Check `configure` and the event name against the Vite proxy (http-proxy-3) shipped with Angular 22.

- [ ] **Step 1: Write the failing test**

```ts
it('replaces a spoofed header with the socket address', () => {
  const headers = new Map<string, string>([['x-forwarded-for', '6.6.6.6']]);
  forwardClientIp({ setHeader: (n, v) => headers.set(n, v) }, { socket: { remoteAddress: '127.0.0.1' } });
  expect(headers.get('x-forwarded-for')).toBe('127.0.0.1');
});
```

- [ ] **Step 2: Run** the web unit tests — Expected: FAIL (module not found).
- [ ] **Step 3: Implement** `proxy.conf.mjs` and switch `angular.json`.
- [ ] **Step 4: Run** the web unit tests, then by hand: start the API and `pnpm --filter @swarm-keeper/web start`, `CHECK_PROXY=1 pnpm infra:check` — Expected: PASS.
- [ ] **Step 5: Commit** `fix(web): dev proxy overwrites x-forwarded-for`

### Task 7: Lint fails on skipped tests

**Files:**
- Modify: `eslint.config.mjs` (or whatever the root config file is called)
- Create: a fixture test in `tools/boundaries` that lints a snippet with `it.skip(…)` and expects the rule to fire (follow that package's existing ESLint-API tests)

**Interfaces:** none.

- [ ] **Step 1: Write the failing test**: `ESLint.lintText` of `it.skip('x', () => {})`, `describe.only(…)`, `test.todo('x')` and `test.fixme(…)` under the path `apps/api/src/x.spec.ts` yields `no-restricted-properties` errors. `test.skip(condition, reason)` inside e2e is also banned (it is not used today).
- [ ] **Step 2: Run** `pnpm --filter @swarm-keeper/boundaries test` (match the package name) — Expected: FAIL.
- [ ] **Step 3: Implement** a config block for `**/*.spec.ts` with `no-restricted-properties` on objects `it`, `test`, `describe` × properties `skip`, `only`, `todo`, `skipIf`, `runIf`, `fixme`.
- [ ] **Step 4: Run** the test and `pnpm lint` — Expected: PASS, no new errors in the codebase.
- [ ] **Step 5: Commit** `chore: lint fails on skipped or focused tests`

### Task 8: CI workflow and docs

**Files:**
- Create: `.github/workflows/ci.yml`
- Modify: `CLAUDE.md` (a "CI" line under Tests), `docs/superpowers/roadmaps/2026-11-23-better-auth-roadmap.md` (step 7: what this step did, what waits for the deployment stack: Caddy layer, `/.well-known/*`)

- [ ] **Step 1: Write** `ci.yml`: `on: pull_request` and `push: branches: [main]`; `concurrency` per ref with cancel-in-progress. Shared `services`: `postgres` (`postgres:18.7-alpine`, `POSTGRES_USER/PASSWORD=swarm`, `POSTGRES_DB=swarm_keeper`, port `5432:5432`, `--health-cmd "pg_isready -U swarm"`), `mailpit` (`axllent/mailpit:v1.34.0`, ports `1025:1025`, `8025:8025`). Steps: checkout, `pnpm/action-setup` (version from `packageManager`), `actions/setup-node` (Node 26, cache pnpm), `pnpm install --frozen-lockfile`.
  - Job `check`: `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm db:roles` (with `NODE_ENV=development`), `pnpm test`.
  - Job `e2e`: `pnpm db:roles`, `pnpm --filter @swarm-keeper/web-e2e exec playwright install --with-deps chromium`, `pnpm e2e`; on failure `actions/upload-artifact` with the Playwright report.
  - Pin action versions to the current major tags.
- [ ] **Step 2: Verify locally**: `actionlint .github/workflows/ci.yml` if available (otherwise `npx --yes actionlint`), Expected: no errors. The first real run happens when the PR is opened (finishing step); check it with `gh run watch` — Expected: both jobs green.
- [ ] **Step 3: Update** `CLAUDE.md` and the roadmap.
- [ ] **Step 4: Commit** `ci: lint, typecheck, build, tests and e2e on every PR`
- [ ] **Step 5: Ask the owner** to make `check` and `e2e` required checks on `main` (or for approval to do it with `gh api`).
