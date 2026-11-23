# Auth permissions (step 3b) design

November 23, 2026. Status: approved. Step 3, part b, of `docs/superpowers/roadmaps/2026-11-23-better-auth-roadmap.md`; builds on 3a (`2026-11-23-auth-core-design.md`).

## Intent

3a made Better Auth run and closed sign-up. 3b makes the role matrix and the 2FA rule bite on every admin action, gives the client one call (`GET /me`) to learn who it is and what it may do, and pins the remaining security tests.

## Scope

**Goals:** `@RequirePermission(resource, action)`; the 2FA rule on our routes and on Better Auth's organization routes; one role per member; the active family set at sign-in; `GET /api/v1/me`; `{ code, params }` errors on our routes; tests for viewer upload, another family, `creatorRole`, single roles, 2FA and `/me`.

**Non-goals:** RLS and `SET LOCAL` (step 7, with the first archive tables); real archive endpoints (the permission test uses a test-only controller); web screens (step 6).

## Approaches

| | Approach | Trade-off |
| --- | --- | --- |
| **A (chosen)** | 2FA by account: an owner or admin who has a password and no 2FA gets `TWO_FACTOR_REQUIRED` on admin actions, whatever they signed in with | Simple and robust; matches the spec skeleton's `twoFactorEnabled` check; a passkey-only owner is exempt. An owner with a spare password must enable 2FA too |
| B | 2FA by session: a sign-in hook marks password sessions, and only those need 2FA | Literal to the spec wording; needs a session column and a sign-in hook, and the rule depends on how the session was opened |

The rule is enforced in two places because admin actions arrive two ways: our controllers (decorator) and Better Auth's own `/api/auth/organization/*` routes (`hooks.before`). Both call one shared check.

## Design

- **Shared rules** (identity module): `isAdminAction(resource, action)` derived from `@swarm-keeper/permissions` roles — allowed for admin or owner, not for member; no hand-kept list. `twoFactorRequired(user)` — the user has a password (`credential`) account and `twoFactorEnabled` is not true.
- **`@RequirePermission(resource, action)`** on top of the wrapper's `@MemberHasPermission`, so it needs a session with an active family and the member's role must allow the action; for admin actions it also applies the 2FA rule.
- **Better Auth `hooks.before`** on `/organization/invite-member`, `/update-member-role`, `/remove-member`, `/cancel-invitation`, `/update`, `/delete`: the 2FA rule for owners and admins (`TWO_FACTOR_REQUIRED`); on invite and role change the `role` must be exactly one family role (`SINGLE_ROLE_REQUIRED`). `creatorRole` stays at Better Auth's default: only an owner grants or changes the owner role.
- **Active family:** `session.create.before` sets `activeOrganizationId` to the user's first family by join date when the session has none.
- **`GET /api/v1/me`:** `user` (`id`, `name`, `email`, `locale`, `uiSize`, `twoFactorEnabled`), `families` (`id`, `name`, `role`), `activeFamilyId`, `role` (in the active family, or `null`), `permissions` (`resource:action` strings allowed by that role), `twoFactorRequired`.
- **Errors:** a global Nest exception filter answers every error from our routes as `{ code, params }`: 401 → `UNAUTHENTICATED`, 403 → `FORBIDDEN`, 404 → `NOT_FOUND`, our own codes as thrown, anything unexpected → `INTERNAL` (500, details only in the log). Better Auth's responses stay `{ code, message }`; the client reads only `code`, documented in `backend.md`.
- **Tests (real Postgres, never skipped):** a test-only controller with `@RequirePermission('asset', 'create')` — viewer 403, member 200; a session whose `activeOrganizationId` is a family the user is not in → 403, and `set-active` to that family is rejected; `creatorRole` — an admin can't invite an owner or promote to owner, an owner can; `"admin,member"` rejected on invite and on role change; 2FA — an owner with a password and no 2FA gets `TWO_FACTOR_REQUIRED` on invite and on an admin route, passes with 2FA on or without a password, a member is unaffected; `/me` permissions per role; error shape.
- **Docs:** `authentication.md` (the 2FA rule by account, the codes), `backend.md` (Better Auth error shape), roadmap.

## Builder's calls

- How a test turns on 2FA for a user (set `twoFactorEnabled` directly, or run the TOTP flow).
- How the hook resolves the caller's role for the 2FA check (active member lookup or Better Auth's API).
- The exact `params` of each code (empty object unless the code needs data).
