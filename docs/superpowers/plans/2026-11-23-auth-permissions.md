# Auth Permissions (3b) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every admin action, ours or Better Auth's, checks the role matrix and the 2FA rule; one role per member; `GET /api/v1/me`; `{ code, params }` errors on our routes; the remaining security tests pass.

**Architecture:** In `apps/api/src/modules/identity/`: `rules.ts` (pure `isAdminAction`, `permissionsOf`, `twoFactorRequired`), `require-permission.ts` (decorator + guard), `organization-hooks.ts` (Better Auth `hooks.before` and `session.create.before`), `me.controller.ts`. In `apps/api/src/`: `error.filter.ts`, registered in `configureApp`.

**Tech Stack:** Better Auth 1.7.27 (organization plugin, `createAuthMiddleware`), `@thallesp/nestjs-better-auth` 2.8.0 (`MemberHasPermission`, `Session`), NestJS 12, Vitest 5, supertest.

**Spec:** `docs/superpowers/specs/2026-11-23-auth-permissions-design.md`

## Global Constraints

- Codes: `TWO_FACTOR_REQUIRED`, `SINGLE_ROLE_REQUIRED`, `UNAUTHENTICATED`, `FORBIDDEN`, `NOT_FOUND`, `INTERNAL`; `params` is `{}` unless a code needs data.
- 2FA rule: user has a `credential` account and `twoFactorEnabled !== true`, and acts as owner or admin on an admin action.
- Admin action = allowed for owner or admin, denied for member, computed from `roles` in `@swarm-keeper/permissions`.
- Better Auth routes guarded by the hook: `/organization/invite-member`, `/organization/update-member-role`, `/organization/remove-member`, `/organization/cancel-invitation`, `/organization/update`, `/organization/delete`.
- `creatorRole` stays at Better Auth's default; not re-implemented.
- No new plugins. Tests send a distinct `x-forwarded-for` per request (`clientIp()`).
- ESM, `.js` suffixes, Conventional Commits.

## Review Focus

1. A member must not receive `TWO_FACTOR_REQUIRED` for an action they are not allowed to do at all: the answer is `FORBIDDEN` — Task 2 test.
2. A role list with spaces or a trailing comma (`"admin, member"`, `"member,"`) must be rejected like `"admin,member"` — Task 2 test table.
3. A user with no families must get `/me` with `families: []`, `activeFamilyId: null`, `role: null`, `permissions: []`, not a 500 — Task 3 test.
4. An exception that is not an `HttpException` must answer `{ code: 'INTERNAL', params: {} }` without leaking its message — Task 3 test.
5. Removing the user from the active family must not leave old permissions working: the guard reads the member row per request — Task 1 test (delete the member row, same session → 403).

---

### Task 1: Rules and `@RequirePermission`

**Files:**
- Create: `apps/api/src/modules/identity/rules.ts`, `rules.spec.ts`, `require-permission.ts`, `require-permission.spec.ts`
- Modify: `apps/api/src/modules/identity/testing.ts` (helpers: `addMember`, `signInAs` returning a bearer token for a user with a chosen active family, `enableTwoFactor`, `givePassword`), `index.ts`

**Interfaces:**
- `isAdminAction(resource: Resource, action: string): boolean`; `permissionsOf(role: FamilyRole): string[]` (`'asset:read'` …, sorted); `twoFactorRequired(user: { twoFactorEnabled: boolean | null }, hasPassword: boolean): boolean`.
- `RequirePermission(resource, action)` — `applyDecorators(MemberHasPermission({ permissions: { [resource]: [action] } }), UseGuards(TwoFactorGuard))` with metadata for the guard; `TwoFactorGuard` throws `ForbiddenException({ code: 'TWO_FACTOR_REQUIRED', params: {} })` when `isAdminAction` and `twoFactorRequired`.

- [ ] **Step 1: Failing tests** `rules.spec.ts`: `isAdminAction('asset','manage') === true`, `('asset','create') === false`, `('archive','export') === true`, `('member','create') === true`, `('organization','delete') === true`; `permissionsOf('viewer')` equals `['album:read','asset:read']`; `permissionsOf('member')` contains `asset:create` and not `asset:manage`; `twoFactorRequired` truth table (password × enabled).
- [ ] **Step 2: Failing tests** `require-permission.spec.ts` (test-only controllers `POST /api/v1/test/assets` with `@RequirePermission('asset','create')` and `POST /api/v1/test/purge` with `@RequirePermission('archive','purge-trash')`):
  - viewer → 403, member → 200 on assets;
  - session with `activeOrganizationId` of a family the user is not in → 403; `POST /api/auth/organization/set-active` to that family → rejected (≥ 400);
  - member row deleted, same session → 403;
  - owner with a password and no 2FA → purge 403 `TWO_FACTOR_REQUIRED`; with `twoFactorEnabled` → 200; passkey-only owner (no credential account) → 200; member → purge 403 `FORBIDDEN`-shaped (not `TWO_FACTOR_REQUIRED`).
  Run `pnpm --filter @swarm-keeper/api test`. Expected: FAIL.
- [ ] **Step 3:** Implement. Run. Expected: PASS.
- [ ] **Step 4:** `pnpm lint && pnpm typecheck && pnpm test`. Expected: exit 0.
- [ ] **Step 5: Commit** `feat(identity): add RequirePermission with the 2FA rule`.

### Task 2: Better Auth organization hooks and the active family

**Files:**
- Create: `apps/api/src/modules/identity/organization-hooks.ts`, `organization-hooks.spec.ts`
- Modify: `create-auth.ts` (`hooks.before`, `databaseHooks.session.create.before` merged with the invite-only hooks)

**Interfaces:**
- Consumes: `twoFactorRequired`, `isFamilyRole` from Task 1 / permissions.
- `organizationHooks(db: Database)`: a `createAuthMiddleware` that, for the guarded paths, resolves the caller (session) and their role in the target family; owner/admin + `twoFactorRequired` → `APIError('FORBIDDEN', { code: 'TWO_FACTOR_REQUIRED' })`; on `invite-member` / `update-member-role` a body `role` that is not exactly one `FamilyRole` → `APIError('BAD_REQUEST', { code: 'SINGLE_ROLE_REQUIRED' })`.
- `activeFamilyHook(db)`: `session.create.before` returning `{ data: { ...session, activeOrganizationId } }` with the first membership by `created_at` when none is set.

- [ ] **Step 1: Failing tests** `organization-hooks.spec.ts` (HTTP to `/api/auth/organization/*`):
  - owner with 2FA invites `role: 'owner'` → 200; admin with 2FA invites `owner` → rejected; admin promotes a member to `owner` → rejected; owner promotes → 200 (`creatorRole`);
  - `it.each(['admin,member', 'admin, member', 'member,'])` on invite and on update-member-role → 400 `SINGLE_ROLE_REQUIRED`;
  - owner with a password, no 2FA: invite → 403 `TWO_FACTOR_REQUIRED`, remove-member → same; same owner with 2FA → 200;
  - member invite → rejected by Better Auth, code is not `TWO_FACTOR_REQUIRED`;
  - sign-in of a user with one family → `get-session` shows that `activeOrganizationId`; a user without families → `null`.
  Run. Expected: FAIL.
- [ ] **Step 2:** Implement and wire. Run. Expected: PASS.
- [ ] **Step 3:** `pnpm lint && pnpm typecheck && pnpm test`. Expected: exit 0.
- [ ] **Step 4: Commit** `feat(identity): enforce 2FA and single roles on family admin routes`.

### Task 3: `GET /me`, error filter and docs

**Files:**
- Create: `apps/api/src/modules/identity/me.controller.ts`, `me.controller.spec.ts`, `apps/api/src/error.filter.ts`, `apps/api/src/error.filter.spec.ts`
- Modify: `identity.module.ts` (controller), `apps/api/src/configure-app.ts` (global filter), `docs/architecture/authentication.md`, `docs/architecture/backend.md`, `docs/superpowers/roadmaps/2026-11-23-better-auth-roadmap.md`

**Interfaces:**
- `GET /api/v1/me` → `{ user: { id, name, email, locale, uiSize, twoFactorEnabled }, families: { id, name, role }[], activeFamilyId: string | null, role: FamilyRole | null, permissions: string[], twoFactorRequired: boolean }`; `twoFactorRequired` is true only when the active role is owner/admin and `twoFactorRequired(user, hasPassword)`.
- `ErrorFilter` (`@Catch()`): `HttpException` with a body `{ code }` → that code and `params ?? {}`; plain 401/403/404 → `UNAUTHENTICATED` / `FORBIDDEN` / `NOT_FOUND`; other `HttpException` → `HTTP_<status>`; anything else → 500 `INTERNAL`, logged.

- [ ] **Step 1: Failing tests:**
  - `me.controller.spec.ts`: without a session → 401 `{ code: 'UNAUTHENTICATED', params: {} }`; viewer → `permissions` `['album:read','asset:read']`, `role: 'viewer'`; owner with a password and no 2FA → `twoFactorRequired: true`; user with no families → empty/null fields, 200; two families → both listed with roles.
  - `error.filter.spec.ts` (test-only controller throwing): `new Error('secret detail')` → 500 `{ code: 'INTERNAL', params: {} }` and the body does not contain `secret detail`; `NotFoundException()` → 404 `NOT_FOUND`; `ForbiddenException({ code: 'X', params: { a: 1 } })` → `{ code: 'X', params: { a: 1 } }`.
  Run. Expected: FAIL.
- [ ] **Step 2:** Implement the controller and the filter; register the filter in `configureApp`. Run. Expected: PASS.
- [ ] **Step 3: Docs:** `authentication.md` — 2FA by account (password + no 2FA), the guarded Better Auth routes, `SINGLE_ROLE_REQUIRED`, the active family at sign-in, `/me` shape; `backend.md` — errors from our routes are `{ code, params }`, Better Auth's are `{ code, message }` and clients read only `code`; roadmap — step 3 done.
- [ ] **Step 4:** `pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm exec prettier --check .`. Expected: exit 0. Smoke: `NODE_ENV=development` API, sign in as the dev owner (`owner@example.test`), `GET /api/v1/me` with the cookie → `role: 'owner'`, `twoFactorRequired: true`.
- [ ] **Step 5: Commit** `feat(identity): add GET /me and code-only errors`.
