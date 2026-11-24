# Web sign-in and invitation (step 6a) design

November 24, 2026. Status: approved. Step 6, part a, of `docs/superpowers/roadmaps/2026-11-23-better-auth-roadmap.md`. Part b (`/settings/security`, resending invitations, the icon font subset) gets its own design.

## Intent

People must be able to join a family from an invitation link and sign in, in their own language. This is the first time a person meets the app, and many of them are elderly relatives, so the default path is a passkey: a fingerprint, Face ID or PIN, with no password to invent. A password stays as the fallback for devices without passkeys. An invitee who signs up with a passkey has no password, so the 2FA rule for owners and admins (step 3b) never applies to them.

## Scope

**Goals:**
- **API:**
  - an anonymous invitation lookup for the invitation page;
  - passkey-first sign-up from an invitation, with no password.
- **Web:**
  - `AuthService` (session, families, active family and permissions from `GET /me`);
  - `authGuard`, `familyGuard`, `permissionGuard`, the `*appCan` directive and the HTTP interceptor;
  - screens `/login`, `/invite/:token` and `/reset-password`, plus a minimal signed-in placeholder at `/`.
- **Tests:** Playwright end to end in `en` and `ru`, including passkeys on a virtual authenticator.

**Non-goals (6b or later):**
- `/settings/security`: passkey list, enabling 2FA, sessions.
- Resending invitations and the invite dialog.
- The icon font subset.
- Recovery links from an admin.
- Magic links.
- Real home, gallery or family screens.

**Anti-goals:**
- An invitation page that lets someone sign up with an email other than the invited one.
- A lookup that reveals anything to a caller without a valid invitation id.
- A passkey sign-up that leaves a password (`credential`) account behind.
- A flow that creates an account and then fails half-way, leaving a user who is not a family member.
- Any literal text in templates.

## Decided by the owner

- An invitee chooses between a passkey (primary) and a password (fallback, behind a link) when creating the account.
- **`/login`, layout B:**
  - one large "Sign in with passkey" button with the hint "fingerprint, Face ID or PIN";
  - a "Sign in with password →" link that opens the email and password form;
  - after a password, owners and admins with 2FA enter a 6-digit code, or use a backup code;
  - errors appear in a `danger-container` box above the form;
  - a language switch sits at the bottom.
- **`/invite/:token`, as in `docs/design/mockups/auth/`:**
  - the title "Invitation to the family «…»", who invites, the role as a badge;
  - the email from the invitation, read-only;
  - the name is asked ("What should we call you");
  - "Create account with passkey" with the hint "no password needed", and "Create with password →" (password of at least 12 characters);
  - after a password sign-up, an offer to add a passkey (with "Later");
  - an expired or used invitation shows "This link no longer works" with "Sign in if you have an account".
- The name is asked at sign-up.
- Step 6 is split into 6a and 6b.
- A person who already has an account (for example, in another family) accepts a new invitation in 6a by signing in and clicking "Accept invitation". The second family then appears in their list.
- The mockups the screens follow are committed as `docs/design/mockups/auth/login.html` (layout B is the chosen one) and `docs/design/mockups/auth/invite.html`.

## Approaches (passkey-first sign-up)

| | Approach | Trade-off |
| --- | --- | --- |
| **A (chosen)** | Better Auth's passkey plugin with `registration.requireSession: false`. `resolveUser` checks the invitation and returns a provisional user; `afterVerification` creates the user and the membership; `createSession: true` signs in | WebAuthn stays in Better Auth's code; one transaction; a little glue code in `identity` |
| B | Our own endpoint doing WebAuthn with `@simplewebauthn/server` | Duplicates the plugin and grows security-sensitive code we would own |
| C | Sign up with a hidden random password, then add a passkey | Leaves a `credential` account, so admins must set up 2FA. It defeats the reason for passkey-first |

## Design

### API (`apps/api/src/modules/identity`)

**`GET /api/v1/invitations/:id`**
- `@AllowAnonymous()`.
- Answers `{ email, familyName, inviterName, role, locale, expiresAt, hasAccount }` only for a `pending`, unexpired invitation.
- `hasAccount` says whether a user with that email exists, so the page can offer "sign in to accept" instead of sign-up. This tells the holder of the emailed link only about their own address.
- Anything else (unknown id, not a UUID, expired, accepted, canceled) answers 404 `{ code: 'INVITATION_NOT_FOUND', params: {} }`, the same for every case.
- The id is the secret from the email: a UUIDv7 with 74 random bits, so guessing ids is not a practical attack. The page shows only what the email already said.
- **No extra rate limiter in 6a (builder's call).** Better Auth's limiter covers only `/api/auth/*`, and adding `@nestjs/throttler` with in-memory counts would be weaker than it looks. A per-IP limit for `/api/v1` comes with the Caddy layer in step 7.

**Passkey-first sign-up**, with the passkey plugin options in `create-auth.ts`:
- **`registration.requireSession: false`.** Signed-in users still register passkeys for themselves through the session path (6b).
- **`registration.resolveUser({ ctx, context })`.**
  - `context` is a JSON string `{ invitation: <id>, name: <display name> }` sent by the client to `/passkey/generate-register-options`.
  - Without a session, it requires a pending, unexpired invitation (`findPendingInvitation`) and an email with no existing user; otherwise it fails with `INVITE_REQUIRED`.
  - It returns `{ id: <new UUIDv7>, name: <invitation email>, displayName: <name> }`. The id becomes the WebAuthn user handle and the user's id.
  - A name that is empty after trimming is rejected (`NAME_REQUIRED`).
- **`registration.afterVerification({ ctx, user, context })`** runs inside the plugin's registration transaction.
  - It re-checks the invitation, then creates the `user` row with `id = user.id`, `email`, `name`, `emailVerified: true`, and `locale` / `uiSize` from the invitation.
  - It inserts the `member` row with the invitation's role and marks the invitation `accepted`.
  - It returns `{ userId: user.id }`.
  - The user is created through Better Auth's internal adapter, so the existing `user.create` hooks run. The invite-only hook must accept the invitation from the passkey context as well as from `inviteToken`. The builder picks the mechanism: for example, a request-scoped value set by `afterVerification`, or reading the verified context.
  - No `account` row of type `credential` is created.
- **Session.** The client calls `/passkey/verify-registration` with `createSession: true`. The session hooks from 3b set the active family.
- **Password path:** unchanged (`/sign-up/email` with `inviteToken`, then sign in). The client sends `name` from the form.
- **Existing account:** Better Auth's `/organization/accept-invitation` is used by a signed-in user whose email matches; their email is already verified, because every account was created from an invitation.
  - After accepting, the session's active family switches to the new family (`/organization/set-active`).
- **Transactions (risk to handle):** `afterVerification` runs inside Better Auth's adapter transaction (`runWithTransaction`).
  - The existing `user.create.after` hook writes `member` and `invitation` with our own Kysely `db` in a separate `db.transaction()`. On the passkey path it would insert the member twice, or write on another connection before the user row is committed.
  - So the passkey path writes through the current adapter (`getCurrentAdapter`), and the after-hook skips that path.
- **Language:** the language the visitor last chose on `/invite` wins. The client sends it as `locale`: in the passkey `context` and in the password sign-up body as the user's additional field. The server takes it over `invitation.locale` when it is `en` or `ru`. On `/login`, the account's stored `locale` applies after sign-in; changing it for good is a setting (6b and later).

**Error codes** (added to the `{ code, params }` set and translated on the web under `errors.auth.*`): `INVITATION_NOT_FOUND`, `NAME_REQUIRED`, plus the existing `INVITE_REQUIRED`, `TWO_FACTOR_REQUIRED` and the Better Auth codes the screens can show (`INVALID_EMAIL_OR_PASSWORD`, `INVALID_TWO_FACTOR_CODE`, `PASSWORD_TOO_SHORT`, passkey `REGISTRATION_CANCELLED`, …).

### Web

**Packages:**
- `better-auth` (catalog) and `@better-auth/passkey` in `libs/web/core`.
- The client is `createAuthClient` from `better-auth/client` with `passkeyClient`, `twoFactorClient` and `organizationClient`, using the same origin (`/api/auth`).

**`libs/web/core`:**
- **`AuthService`** (root): `me` is a resource on `GET /api/v1/me`.
  - Signals: `user`, `families`, `activeFamilyId`, `role`, `permissions`, `signedIn`, `twoFactorRequired`.
  - Methods:
    - `signInPasskey()`;
    - `signInPassword(email, password)`, which returns `'ok' | 'two-factor'`;
    - `verifyTotp(code)` and `verifyBackupCode(code)`;
    - `signUpPasskey(invitationId, name)` and `signUpPassword(invitationId, email, name, password)`; the latter signs in right after;
    - `addPasskey()`;
    - `requestPasswordReset(email)` and `resetPassword(token, password)`;
    - `signOut()`, `refresh()`.
  - After `/me` loads, it calls `AppearanceService.setLang(user.locale)` and `setUiSize(user.uiSize)`.
- **Guards** (`canMatch`):
  - `authGuard`: a session exists, otherwise `/login?returnUrl=…`;
  - `guestGuard`: no session, for `/login` and `/reset-password` (not `/invite`, which has signed-in states);
  - `familyGuard`: an active family;
  - `permissionGuard(resource, action)`.
- **`*appCan="['asset', 'delete']"`** (plus an optional `ownerId`) renders its content only when `permissions` contains `resource:action`.
- **Interceptor:**
  - 401 from `/api/v1/*` → `/login?returnUrl=<current url>`;
  - 403 with `TWO_FACTOR_REQUIRED` → `/settings/security` (the route arrives in 6b; until then the user sees the 403 message);
  - any other 403 → a translated "not allowed" message through the toast.

**`libs/web/features/auth`** (new feature, layers `data-access` / `feature` / `ui`, translations in `i18n/auth/{en,ru}.json`, plus `errors.auth.*`):
- **`/login`** (layout B, steps: passkey → password form → 2FA code or backup code). On success it goes to `returnUrl` or `/`. A "Forgot your password?" link under the password form opens an email field that calls `requestPasswordReset`, then shows "If the address is in the archive, we sent a link" whatever happened.
- **`/invite/:token`:**
  - Loads the invitation and switches the language to `invitation.locale` (the visitor can still switch).
  - States, as in `docs/design/mockups/auth/`: loading, passkey, password form, "add a passkey" after a password sign-up, and invalid/expired.
  - **Existing account, not signed in** (`hasAccount`): "You already have an account. Sign in to accept". It opens `/login?returnUrl=/invite/:token`.
  - **Signed in with the invited email:** "Accept invitation" (`accept-invitation`, then set the new family active and go to `/`).
  - **Signed in as someone else:** the invitation with "Sign out to accept".
- **`/reset-password?token=…`:** a new password (≥ 12) twice, then `/login` with a success note.
- **`/`:** a minimal signed-in placeholder ("You are in the family «…»" and "Sign out"), behind `authGuard`, until the real home exists.

### Tests

**Unit (Vitest):**
- `AuthService` signals from a mocked `/me`;
- the guards;
- `*appCan`;
- the interceptor (401 with `returnUrl`, `TWO_FACTOR_REQUIRED`);
- each screen's states.

**API integration (never skipped, added to the security tests):**
- The lookup answers 404 for unknown, expired, accepted and canceled invitations, and the body has no data; `hasAccount` is true only for an existing user.
- Passkey sign-up without a valid invitation is rejected and creates no user.
- Passkey sign-up for an email that already has an account is rejected.
- A successful passkey sign-up creates the user, the membership and the accepted invitation, with no `credential` account and `emailVerified` true.
- The 2FA rule does not apply to a passkey-only admin.

**Playwright** (new package `apps/web-e2e`):
- Chromium with a CDP virtual authenticator. It starts the API (`NODE_ENV=test` against a migrated `swarm_keeper_e2e` database) and the web dev server; Postgres and Mailpit come from `pnpm infra:up`.
- Scenarios, each in `en` and `ru`:
  - invite → passkey sign-up → placeholder;
  - invite → password sign-up → "add a passkey" → placeholder;
  - sign in with a passkey;
  - sign in with a password;
  - an owner with 2FA signs in with a TOTP code;
  - a member of one family accepts an invitation to a second family (sign in → accept → both families in `/me`);
  - an expired invitation;
  - a wrong password error.
- Invitations are created by a seeded owner through the API; reset links are read from Mailpit.
- `pnpm e2e` runs it; it is not part of `pnpm test`.

## Constraints

- Better Auth 1.7.27 option names are checked against the installed plugin (`requireSession`, `resolveUser`, `afterVerification`, `createSession`, `context`).
- Only the organization, passkey, twoFactor and bearer plugins stay enabled.
- Frontend invariants from `CLAUDE.md`: standalone, OnPush, signals, Signal Forms, tokens only, no fixed widths, and no literal text in templates.
- `docs/architecture/authentication.md` (the sign-up flow, step 3), `frontend.md` and the roadmap are updated in the same change.

## Left to the builder

- How the invite-only hook learns the invitation on the passkey path.
- How Playwright starts and seeds its stack.
- The exact component split inside `features/auth`.
- The wording of the texts, within the glossary and tone rules.
