# Better Auth roadmap

November 23, 2026. Status: approved by the owner (November 23, 2026).

Authentication is specified in `docs/architecture/authentication.md` (Better Auth inside the API, invite-only sign-up, passkeys, 2FA for owners and admins, families as organizations, roles owner / admin / member / viewer). It spans the database, the API, email and the web app, so it is delivered in steps. Each step gets its own design, plan, branch and PR, and ends with something that runs and is tested.

The spec targets Better Auth 1.6; the current release is 1.7.27. Every step checks option names against the docs of the pinned version.

## Steps

| # | Step | Depends on | Done when |
| --- | --- | --- | --- |
| 1 | Permissions library | — | Role matrix is code and unit-tested |
| 2 | Database layer and migrations | — | Migrations run against the dev Postgres from `pnpm`; API tests use a migrated test database |
| 3 | Auth core in the API | 1, 2 | Seeded owner invites a person; they sign up via API; the four security tests pass |
| 4 | Email | 3 | Invitation, verification and reset emails in en/ru land in a dev mailbox |
| 5 | Web foundations | — | Transloco, Material theme and generated design tokens in the web app |
| 6 | Web sign-in and invitation screens | 3, 4, 5 | `/login`, `/invite/:token`, `/settings/security` work end to end |
| 7 | Hardening (later) | 3, archive tables, deployment | RLS per request, Caddy rate-limit layer, CI gate on the security tests |

Steps 1, 2 and 5 are independent and can be done in any order. The proposed order is 1 → 2 → 3 → 4 → 5 → 6.

### 1. Permissions library

- `libs/shared/permissions`: `ac` and `roles` via `createAccessControl`, statements `asset`, `album`, `archive` on top of the organization plugin defaults, and the viewer role.
- Unit tests pin the matrix in `authentication.md` ("Roles and permissions") row by row.
- Used by the API now and by the web app later, so it depends only on `better-auth` access-control exports.
- **Open:** none.

### 2. Database layer and migrations

- Query builder and migration tool: **Kysely** (decided). Why: Better Auth already uses it internally, it stays close to SQL (RLS, `SET LOCAL`, `tsvector`, generated columns), and its migrator keeps every migration in plain TypeScript.
- Migration scripts (`db:migrate`, `db:migrate:down`, `db:new`) against the dev Postgres from `compose.yaml`.
- Better Auth tables move to step 3: its CLI generates them from the full `auth.ts` config, which only exists there. Step 2 lays the migration infrastructure and a first `pg_trgm` migration.
- IDs are UUIDv7: Better Auth's ID generation must be configured to produce them, and our tables use them too.
- **Decided:** Kysely.

### 3. Auth core in the API

Delivered in two PRs. **3a** (`docs/superpowers/specs/2026-11-23-auth-core-design.md`): tables, configuration, Nest integration, invite-only sign-up, mailer interface, seed, and the tests for sign-up without an invitation and an unverified email. **3b**: `@RequirePermission`, the 2FA rule, `GET /me`, `{ code, params }` errors, and the tests for viewer upload, another family, `creatorRole` and one role per member.

- Better Auth tables: generated with its CLI from `auth.ts` and committed as our migration, so the whole schema history lives in one place.
- `auth.ts` per the spec skeleton: email + password with required verification, sessions 30 days / extended daily, `cookieCache` off, rate limiting in the database, only the organization, passkey, twoFactor and bearer plugins, `allowUserToCreateOrganization: false`, `user.locale` / `user.uiSize` and `invitation.locale` / `invitation.uiSize`.
- `identity` module with `@thallesp/nestjs-better-auth` (2.8, supports Nest 12): `/api/auth/*`, global guard, `@AllowAnonymous()`, `@Session()`, our `@RequirePermission(resource, action)`.
- The `user.create.before` hook: rejects sign-up without a valid invitation (`INVITE_REQUIRED`), and marks the email verified only when it matches the invitation.
- The 2FA rule: admin actions answer `TWO_FACTOR_REQUIRED` for owners and admins who sign in with a password and have no 2FA.
- `GET /api/v1/me`: user with `locale` and `uiSize`, families, active family, role and effective permissions.
- Seed script: creates the first owner and family.
- Mailer behind an interface; in this step the dev implementation logs the link.
- Integration tests against a real Postgres (never skipped): sign-up without an invitation is rejected; an unverified email can't accept an invitation; a viewer can't upload; another family's data is inaccessible. Until uploads exist, the last two use a small protected endpoint guarded by `@RequirePermission('asset', 'create')` and scoped to the active family.
- Error responses are `{ code, params }`.
- Better Auth telemetry is disabled (`telemetry: { enabled: false }`): a family archive sends nothing to third parties.
- Ownership transfer relies on Better Auth's `creatorRole` rule (1.7.27: only a member with the creator role, default `owner`, can grant or change the owner role, on role change and on invitation). Keep `creatorRole` at its default and pin the rule with an integration test; do not duplicate it in the service layer.
- One role per member: Better Auth accepts role lists (`"admin,member"`), but the matrix assumes a single role. Reject multiple roles on invitation and role change; `isFamilyRole` already returns `false` for a list.
- **Decided:** tests use a separate `swarm_keeper_test` database in the dev Postgres, recreated by the test setup.

### 4. Email

- Mailpit in `compose.yaml` for development.
- Mailer implementation with en/ru templates for invitation, email verification and password reset; language from `invitation.locale` or `user.locale`; terms from the design-system glossary.
- **Open:** the production email service (already an open question in `CLAUDE.md`); this step only needs SMTP to Mailpit.

### 5. Web foundations

- Transloco with per-feature `i18n/<feature>/{en,ru}.json`, ICU plurals, the CI check for missing keys.
- Style Dictionary build of `docs/design/tokens.json` into `libs/shared/design-tokens`; Angular Material themed through `--mat-sys-*`; compact / large size modes.
- Not auth-specific, but the auth screens need it.
- **Open:** none beyond what `frontend.md` and `docs/design/` already fix.

### 6. Web sign-in and invitation screens

- `AuthService` in `libs/web/core` wrapping `createAuthClient`, with `session`, `activeFamily` and `permissions` signals from `GET /me`.
- `authGuard`, `familyGuard`, `permissionGuard`, the `*appCan` directive, and the HTTP interceptor (401 → `/login`, 403 message, `TWO_FACTOR_REQUIRED` → `/settings/security`).
- Screens: `/login` (passkey, password, 2FA), `/invite/:token` (sign-up from an invitation, passkey offered first), `/settings/security` (passkeys, 2FA, sessions).
- Playwright for these screens in both languages.
- **Open:** screen layouts (design system components exist; details settled in the step's design).

### 7. Hardening (later)

- Per-request transaction with `SET LOCAL app.family_id` / `app.user_id` and RLS policies: lands with the first archive tables.
- Second rate-limit layer for `/api/auth/*` in Caddy, and `/.well-known/*` for native passkeys: lands with a deployment stack, which is undecided.
- CI that runs the security tests before every merge and on every Better Auth update.

## Decisions

1. Kysely, not Drizzle (step 2). `backend.md` is updated in step 2.
2. Integration tests use a `swarm_keeper_test` database in the dev Postgres (step 3).
3. Order: 1 → 2 → 3 → 4 → 5 → 6.
