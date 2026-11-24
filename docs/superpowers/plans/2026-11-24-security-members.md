# Security settings, family members and icons (step 6b) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A signed-in person manages their passkeys, 2FA and sessions at `/settings/security`, and an owner or admin invites, resends and cancels invitations at `/family/members`. Icons ship as SVG instead of a 5.4 MB font, and the 6a minors are fixed. Playwright proves it in both languages.

**Architecture:**
- **API (`apps/api/src/modules/identity`):**
  - `user.hasPassword` in `GET /me`;
  - a security `hooks.before`: `LAST_SIGN_IN_METHOD` on passkey delete, `SESSION_NOT_FRESH` before passkey registration options;
  - our own `/api/v1/me/sessions` routes, which never return tokens;
  - `NAME_TOO_LONG` on passkey sign-up.
- **Web:**
  - `libs/web/core` grows the `AuthClientPort` and `AuthService` calls;
  - `libs/web/ui` holds the SVG icon registry;
  - `apps/web` gets a shell with a header and user menu;
  - two new features: `libs/web/features/settings` (`/settings/security`) and `libs/web/features/family` (`/family/members`).
- **End to end:** new scenarios in `apps/web-e2e`.

**Tech Stack:**
- Better Auth 1.7.27: organization, passkey and twoFactor clients.
- NestJS 12, Kysely.
- Angular 22.3: Signal Forms, Material 22.3 (dialog, menu, snack-bar), Transloco 8.4.
- `@material-symbols/svg-400` 0.49.0.
- A small SVG QR library, pinned at install.
- Vitest 5, Playwright 1.65.1.

**Spec:** `docs/superpowers/specs/2026-11-24-security-members-design.md`. Mockup: `docs/design/mockups/settings/members-security.html`.

## Global Constraints

- **New error codes** (`{ code, params }` on our routes; `{ code, message }` from Better Auth hooks, client reads only `code`):
  - `LAST_SIGN_IN_METHOD` (400);
  - `SESSION_NOT_FOUND` (404: unknown id and another user's session give the same answer);
  - `CURRENT_SESSION` (400);
  - `NAME_TOO_LONG` (400).
- **Existing error codes** reused: `SESSION_NOT_FRESH` (403), `NAME_REQUIRED`, `TWO_FACTOR_REQUIRED`, `SINGLE_ROLE_REQUIRED`.
- **Limits:** names (passkey sign-up name, passkey name) are at most **64** characters after trim.
- **`freshAge` is one day** (Better Auth default, unchanged).
- **Session routes never return `token`.**
- **Backup codes and the TOTP secret:**
  - live only in the 2FA dialog's signals and are cleared when it closes;
  - never logged, never written to storage;
  - the download file is `swarm-keeper-backup-codes.txt`.
- **Routes:**
  - `/settings/security`: `authGuard`;
  - `/family/members`: `authGuard`, `familyGuard`, `permissionGuard('member', 'create')`;
  - both, and the placeholder `/`, sit under the shell route.
- **Invite roles:** `admin`, `member`, `viewer`, plus `owner` only when the caller's role is `owner`. The email language is `en` | `ru`, defaulting to the inviter's `user.locale`.
- **Member ⋮ menu:**
  - an owner gets it on every other member; an admin on every other member who is not an owner;
  - never on the person's own row;
  - both items show the snack-bar "Not implemented yet".
- **Frontend rules:**
  - standalone, OnPush, signals, Signal Forms;
  - tokens only, no px, no raw colors, no fixed widths;
  - no literal text in templates;
  - translation scopes `settings` and `family` (`apps/web/src/i18n/<scope>/{en,ru}.json`) and `errors.*` in the root files;
  - the glossary tone: formal «вы», no exclamation marks;
  - dates through `Intl`.
- **Sheriff:**
  - each new feature may use `web:core`, `web:ui` and shared libraries only;
  - features never import each other;
  - the Better Auth client is reached only through `AuthClientPort`.
- **Explicit lists (6a ruling):** each new feature goes into `tsconfig.base.json` paths, the `angular.json` test `include`, and `transloco.config.ts` `input` and `scopePathMap`.
- **Dependencies:** versions pinned exactly. Better Auth route and option names are checked against the installed 1.7.27 before use.
- **Commits:** Conventional Commits with the `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` line.

## Review Focus

1. **Ending sessions from a stale session (older than a day):** listing and ending must still work. `freshSessionMiddleware` must not leak in through a Better Auth call. Test in Task 2: a two-day-old session lists and ends another session.
2. **2FA dialog closed mid-way** (after the password step, before the code):
   - 2FA stays off;
   - reopening starts at the password step;
   - the codes from the abandoned attempt are gone from the component.

   Test in Task 6.
3. **Resending an expired invitation when the old one can't be cancelled:** the new invitation still exists and the person sees "Invitation sent again", not an error. Test in Task 7.
4. **An admin opening the invite dialog:** there is no "Owner" option. Test in Task 7.
5. **The current session's row:** it has no "End" button, and the server refuses it anyway (`CURRENT_SESSION`). Tests in Tasks 2 and 6.

---

### Task 1: API security rules (`/me.hasPassword`, last sign-in method, fresh session before registration, name length)

**Files:**
- Create: `apps/api/src/modules/identity/security-hooks.ts`, `security-hooks.spec.ts`
- Modify:
  - `create-auth.ts`: compose `hooks.before` from `organizationHooks` and `securityHooks`;
  - `me.controller.ts` and `me.controller.spec.ts`: `user.hasPassword`;
  - `passkey-sign-up.ts` and `passkey-sign-up.spec.ts`: `NAME_TOO_LONG`, plus the after-hook test (6a minor 7);
  - `docs/architecture/authentication.md`: the new codes and both rules.

**Interfaces:**
- `securityHooks(db: Database, lookupSession: SessionLookup): (ctx) => Promise<void>`. It acts on two paths and leaves every other path alone:
  - **`/passkey/delete-passkey`.** With a session, it loads the passkey by `body.id`. If the passkey is the caller's, it is their only passkey, and `hasPassword(db, userId)` is false, it throws `APIError('BAD_REQUEST', { code: 'LAST_SIGN_IN_METHOD', message: 'LAST_SIGN_IN_METHOD' })`.
  - **`/passkey/generate-register-options`.** With a session whose `createdAt` is older than `ctx.context.sessionConfig.freshAge` seconds (when `freshAge > 0`), it throws `APIError('FORBIDDEN', { code: 'SESSION_NOT_FRESH', … })`. Without a session (invitation sign-up), it does nothing.
- `combineBefore(...hooks)`: one `createAuthMiddleware` that awaits each hook in order. It lives in `security-hooks.ts`.
- `MeResponse.user.hasPassword: boolean`.
- `NAME_TOO_LONG` is thrown from `parseContext` when `name.trim().length > 64`.

- [ ] **Step 1: Failing tests:**
  - **`security-hooks.spec.ts`** (real Postgres; use `registerWithPasskey` from `testing-webauthn.ts`):
    - **A passkey-only user with one passkey:** `POST /api/auth/passkey/delete-passkey` answers 400 `LAST_SIGN_IN_METHOD`, and the passkey row still exists.
    - **A user with a password and one passkey:** the delete answers 200, and the row is gone.
    - **A passkey-only user with two passkeys:** deleting one answers 200; deleting the second then answers 400.
    - **A session with `createdAt` two days ago:** `GET /api/auth/passkey/generate-register-options` answers 403 `SESSION_NOT_FRESH`.
    - **A fresh session:** the same call answers 200.
    - **The invitation path without a session:** still answers 200 (existing tests in `passkey-sign-up.spec.ts` keep passing).
  - **`me.controller.spec.ts`:** `user.hasPassword` is `true` for a password user and `false` for a passkey-only user.
  - **`passkey-sign-up.spec.ts`:**
    - a name of 65 characters → 400 `NAME_TOO_LONG`, and no user is created;
    - 64 characters → 200;
    - **after-hook test:** the passkey sign-up leaves exactly one `member` row, and the invitation's status is `accepted` exactly once (the invite-only after-hook did not run a second accept).
- [ ] **Step 2:** Run `pnpm --filter @swarm-keeper/api test -- security-hooks me.controller passkey-sign-up`. Expected: FAIL on the new cases.
- [ ] **Step 3: Implement** `securityHooks`, `combineBefore`, the wiring in `create-auth.ts`, `hasPassword` in `/me` and the name check.
- [ ] **Step 4:** Run the whole API suite, then `pnpm lint && pnpm typecheck`. Expected: all green, and the four never-skipped security tests pass.
- [ ] **Step 5: Commit**
  - `feat(identity): keep the last sign-in method and check session freshness before passkey registration`;
  - then `docs: describe the last sign-in method rule`.

### Task 2: Own session routes `/api/v1/me/sessions`

**Files:**
- Create: `apps/api/src/modules/identity/sessions.controller.ts`, `sessions.controller.spec.ts`
- Modify:
  - `identity.module.ts`: register the controller;
  - `docs/architecture/authentication.md`: the routes and codes, in the session list bullet;
  - `docs/architecture/backend.md`, if it lists routes.

**Interfaces:**
- `SessionView { id: string; userAgent: string | null; ipAddress: string | null; createdAt: string; updatedAt: string; current: boolean }`.
- `GET /api/v1/me/sessions` → `SessionView[]`:
  - the caller's sessions with `expiresAt > now()`;
  - sorted by `updatedAt` desc, with the current session first;
  - the response type has no `token` field.
- `DELETE /api/v1/me/sessions/:id` → 204. A non-UUID, unknown or foreign id → 404 `SESSION_NOT_FOUND`; the current id → 400 `CURRENT_SESSION`.
- `DELETE /api/v1/me/sessions` → 204: deletes every session of the caller except the current one.
- **Implementation:** Kysely on the `session` table. The current id comes from `@Session()` (`session.session.id`). Nothing goes through Better Auth's `list-sessions` or `revoke-*`.

- [ ] **Step 1: Failing tests** `sessions.controller.spec.ts`:
  - **Two sign-ins of one user (A and B):**
    - `GET` from A lists both;
    - exactly one has `current: true` (A's);
    - no item has a `token` key (`expect(Object.keys(item)).not.toContain('token')`).
  - **An expired session** (its `expiresAt` set in the past by SQL) is not listed.
  - **A's session with `createdAt` two days ago** still gets 200 on `GET` and 204 on `DELETE` of B.
  - **`DELETE` of B from A** → 204. B's cookie then gets 401 on `GET /api/v1/me`. The same works with B as a bearer token.
  - **`DELETE` of another user's session** → 404 `SESSION_NOT_FOUND`, and that session still works. `DELETE /me/sessions/not-a-uuid` gives the same 404.
  - **`DELETE` of the current session** → 400 `CURRENT_SESSION`.
  - **`DELETE /me/sessions`** with three sessions (A, B, C) → 204; only A remains, and A still works.
  - **No session** → 401 on all three routes.
- [ ] **Step 2:** Run `pnpm --filter @swarm-keeper/api test -- sessions.controller`. Expected: FAIL (404 route).
- [ ] **Step 3: Implement** the controller.
- [ ] **Step 4:** Run the API suite, then `pnpm lint && pnpm typecheck`. Expected: green.
- [ ] **Step 5: Commit** `feat(identity): list and end the caller's sessions without exposing tokens`.

### Task 3: Web core: client port, `AuthService` calls, 6a minors 1, 3, 5

**Files:**
- Modify (all in `libs/web/core/src/auth/`):
  - `auth-client.ts`, `better-auth-client.ts`;
  - `auth.service.ts`, `auth.interceptor.ts`, `guards.ts`;
  - `testing.ts` (`fakeClient` grows the new calls);
  - the specs.

**Interfaces:**
- **`AuthClientPort` additions,** with names as in Better Auth 1.7.27's client; verify each against the installed client and ledger any rename:
  - `passkey.listUserPasskeys`, `passkey.updatePasskey({ id, name })`, `passkey.deletePasskey({ id })`;
  - `addPasskey` accepts `{ name?: string }`;
  - `twoFactor.enable({ password })` → `{ totpURI, backupCodes }`;
  - `twoFactor.generateBackupCodes({ password })` → `{ backupCodes }`;
  - `twoFactor.disable({ password })`;
  - `organization.listMembers({ query: { organizationId } })`, `organization.listInvitations({ query: { organizationId } })`;
  - `organization.inviteMember({ email, role, organizationId, locale, resend? })`;
  - `organization.cancelInvitation({ invitationId })`.

  `lazyPort` delegates each call.
- **`AuthService` additions.** Each method throws `AuthError(code)` on failure and refreshes `/me` where noted.
  - Passkeys:
    - `listPasskeys(): Promise<PasskeyView[]>`, where `PasskeyView { id; name: string | null; createdAt: string }`;
    - `addPasskey(name?: string)`;
    - `renamePasskey(id, name)`;
    - `deletePasskey(id)`.
  - Two-factor:
    - `startTwoFactor(password): Promise<{ totpURI: string; backupCodes: string[] }>`;
    - `confirmTwoFactor(code)` (it is `verifyTotp` plus `refresh()`);
    - `newBackupCodes(password): Promise<string[]>`;
    - `disableTwoFactor(password)` (refresh).
  - Family:
    - `listMembers(): Promise<MemberView[]>`, where `MemberView { id; userId; role; createdAt; user: { name; email } }`;
    - `listInvitations(): Promise<InvitationRow[]>`, where `InvitationRow { id; email; role; status; expiresAt; locale: string | null }`.
    - `invite({ email, role, locale })`;
    - `resendInvitation(row: InvitationRow): Promise<void>`. A row not yet expired → `inviteMember({ …, resend: true })`. An expired row → `inviteMember` without `resend`, then `cancelInvitation(row.id)`. A failed cancel is swallowed; a failed invite throws.
    - `cancelInvitation(id)`.

    All the family calls use `activeFamily().id`.
- **`MeResponse.user.hasPassword: boolean`.**
- **6a minor 1:** the interceptor's 401 exclusion becomes an exact match on the path `/api/v1/me` (query string ignored).
- **6a minor 3:** `refresh()` sets the signed-out state only on a 401. On any other error it keeps the previous state, marks `ready`, and rethrows nothing to guards. Expose `loadError: Signal<boolean>`.
- **6a minor 5:** `guestGuard` returns `router.parseUrl(safeReturnUrl(returnUrl))` for a signed-in user.

- [ ] **Step 1: Failing tests:**
  - **`auth.service.spec.ts`:**
    - `resendInvitation` on a valid row calls `inviteMember` with `resend: true` once and never `cancelInvitation`;
    - on an expired row it calls `inviteMember` without `resend`, then `cancelInvitation(row.id)`;
    - when that cancel fails, it still resolves;
    - when the invite fails, it throws `AuthError` with the code;
    - `startTwoFactor` returns the client's `totpURI` and codes;
    - `disableTwoFactor` triggers a `/api/v1/me` reload.
  - **`/me` errors:** a 500 from `/me` after a signed-in state keeps `signedIn()` true and sets `loadError()`; a 401 sets `signedIn()` false.
  - **`auth.interceptor.spec.ts`:**
    - a 401 from `/api/v1/members` redirects to `/login?returnUrl=…`;
    - a 401 from `/api/v1/me` does not;
    - a 401 from `/api/v1/me?x=1` does not.
  - **`guards.spec.ts`:**
    - signed in on `/login?returnUrl=%2Fsettings%2Fsecurity` → `/settings/security`;
    - with `returnUrl=//evil.example` → `/`.
- [ ] **Step 2:** Run `pnpm --filter @swarm-keeper/web test`. Expected: FAIL on the new cases.
- [ ] **Step 3: Implement.**
- [ ] **Step 4:** Run `pnpm --filter @swarm-keeper/web test && pnpm lint && pnpm typecheck`. Expected: green.
- [ ] **Step 5: Commit** `feat(web): add security and family calls to AuthService and fix /me error handling`.

### Task 4: SVG icons instead of the Material Symbols font

**Files:**
- Create: `libs/web/ui/src/icons/icons.ts`, `icons.spec.ts`
- Modify:
  - `libs/web/ui/src/index.ts`;
  - `apps/web/angular.json`: drop `material-symbols/rounded.css`; add `"loader": { ".svg": "text" }` to build and test;
  - `apps/web/src/app/app.config.ts`: drop the font set, add `provideIcons()`;
  - `apps/web/src/app/dev/foundations.html`: `svgIcon`;
  - `apps/web/package.json` and the catalog: remove `material-symbols`, add `@material-symbols/svg-400@0.49.0`;
  - the docs: `docs/architecture/frontend.md` and `docs/design/README.md` if it names the font;
  - a `declare module '*.svg'` typing if needed.

**Interfaces:**
- `ICONS: Record<string, string>`: name → SVG source, imported from `@material-symbols/svg-400/rounded/<name>.svg`. Outline, not `-fill`.
- `provideIcons(): EnvironmentProviders`: registers each entry with `MatIconRegistry.addSvgIconLiteral(name, sanitizer.bypassSecurityTrustHtml(svg))` in an app initializer.
- **Icons registered in this step:** `upload`, `key`, `shield`, `group`, `logout`, `more_vert`, `add`, `edit`, `delete`, `send`, `close`, `content_copy`, `download`, `check_circle`, `devices`, `person_add`. Later tasks add to this one list.

- [ ] **Step 1: Failing test** `icons.spec.ts`:
  - it collects every `svgIcon="…"` literal from `*.html` and `*.ts` under `apps/web/src` and `libs/web` (excluding `node_modules`);
  - it expects each literal to be a key of `ICONS`;
  - it expects every `ICONS` value to start with `<svg`;
  - it expects no file under `apps/web/src` or `libs/web` to contain `fontIcon=`.
- [ ] **Step 2:** Run the web tests. Expected: FAIL (`ICONS` missing, `fontIcon` found).
- [ ] **Step 3: Implement.** Swap the dependency, then add the registry, the loader and the call-site change.
- [ ] **Step 4:** Run `pnpm --filter @swarm-keeper/web build` and confirm that `ls apps/web/dist/**/browser | grep -c woff2` finds no material-symbols font; record the size of the initial bundle. Then run `pnpm --filter @swarm-keeper/web test && pnpm lint`. Expected: green; the dev showcase shows the upload icon.
- [ ] **Step 5: Commit** `feat(web): ship Material Symbols as registered SVG icons instead of the font`.

### Task 5: App shell with header and user menu

**Files:**
- Create: `apps/web/src/app/shell/shell.ts` (+ html, scss, spec), `apps/web/src/app/shell/home.page.ts` (the placeholder moves here from feature-auth)
- Modify:
  - `apps/web/src/app/app.routes.ts`;
  - `libs/web/features/auth/src/feature/auth.routes.ts`: drop `''`;
  - `apps/web/src/i18n/{en,ru}.json`: `shell.*`;
  - `apps/web/transloco.config.ts`, if the shell keys need the input list.

**Interfaces:**
- **Routes in `appRoutes(dev)`:**
  - the dev routes;
  - `AUTH_ROUTES`;
  - `{ path: '', component: Shell, canMatch: [authGuard], children: [...] }`. The children are:
    - `''` → the home page;
    - `settings` → `loadChildren` from `@swarm-keeper/feature-settings` (Task 6);
    - `family` → `loadChildren` from `@swarm-keeper/feature-family` (Task 7).
- **Header:**
  - the app name, and an avatar button with the first letter of `user.name`;
  - a `mat-menu` whose header line shows the name and email;
  - the items "Security" → `/settings/security` and "Members" → `/family/members`, the latter under `*skCan="'member:create'"`;
  - "Sign out" → `AuthService.signOut()`, then `/login`.
- **Layout:** the header is full width, and the content is a centered column with a token-based `max-inline-size` (no px).

- [ ] **Step 1: Failing test** `shell.spec.ts`, with the fake auth from Task 3's `testing.ts`:
  - a member (role `member`) sees "Security" and "Sign out" but not "Members";
  - an owner sees all three;
  - clicking "Sign out" calls `signOut` and navigates to `/login`;
  - no literal text in the template (use `literalText`).
- [ ] **Step 2:** Run the web tests. Expected: FAIL.
- [ ] **Step 3: Implement** the shell, the routes and the translations. Until Tasks 6 and 7 land, the two `loadChildren` entries are added in those tasks, not here.
- [ ] **Step 4:** Run `pnpm --filter @swarm-keeper/web test && pnpm lint && pnpm typecheck`; the existing e2e `sign-in` still lands on `/` (run `pnpm e2e -- sign-in`). Expected: green.
- [ ] **Step 5: Commit** `feat(web): add the signed-in shell with the user menu`.

### Task 6: `feature-settings`: `/settings/security`

**Files:**
- Create the library `libs/web/features/settings`:
  - `package.json` (`@swarm-keeper/feature-settings`), `tsconfig.json`, `src/index.ts` (`SETTINGS_ROUTES`);
  - `src/data-access/sessions.resource.ts`;
  - `src/data-access/user-agent.ts`, `user-agent.spec.ts`;
  - `src/feature/security.page.ts` (+ html, scss, spec);
  - `src/feature/two-factor.dialog.ts` (+ spec), `src/feature/passkey-name.dialog.ts`, `src/feature/confirm.dialog.ts`;
  - `src/feature/settings.routes.ts`;
  - `src/ui/backup-codes.ts`, `src/ui/qr-code.ts`.
- Modify:
  - `tsconfig.base.json`, the `apps/web/angular.json` test include, `transloco.config.ts` (input and `scopePathMap.settings`);
  - `app.routes.ts`: the shell child `settings`;
  - `apps/web/src/i18n/settings/{en,ru}.json`;
  - the root `errors.*`: `LAST_SIGN_IN_METHOD`, `SESSION_NOT_FRESH`, `CURRENT_SESSION`, `SESSION_NOT_FOUND`, `INVALID_PASSWORD`, `INVALID_CODE`, plus anything Better Auth's twoFactor answers for a wrong code. Verify the exact codes in 1.7.27.
  - `tools/boundaries`: a forbidden case, feature-settings → feature-auth.

**Interfaces:**
- `parseUserAgent(ua: string | null): { browser: string | null; os: string | null }`:
  - **Browsers:** Chrome, Edge, Firefox, Safari, Opera, Samsung Internet. Edge must not report as Chrome, and Chrome must not report as Safari.
  - **Systems:** Windows, macOS, iOS, iPadOS, Android, Linux, ChromeOS.
  - `null` for unknown.
  - The label `"Chrome · Windows"` is joined in the template; an unknown agent shows the translated "Unknown device".
- `sessionsResource()` is an `httpResource<SessionView[]>('/api/v1/me/sessions')`, plus `endSession(id)` and `endOtherSessions()` (`HttpClient.delete`).
- **Security page:**
  - **Passkeys:** the list from `AuthService.listPasskeys()` in a `resource`. "Add" calls `addPasskey(parseUserAgent(navigator.userAgent) label)`.
    - `SESSION_NOT_FRESH` opens the "Sign in again" confirm, which calls `signOut()` and navigates to `/login?returnUrl=%2Fsettings%2Fsecurity`.
    - `PASSKEY_CANCELLED` does nothing.
    - Rename uses `passkey-name.dialog` (required, `maxLength(64)`). Delete uses a confirm, and its errors show in a snack-bar with the code text.
  - **2FA section:** rendered only when `user().hasPassword`.
    - **Off:** an "Enable" button opens `two-factor.dialog`.
    - **On:** a "Turned on" badge, "New backup codes" (a password dialog, then `backup-codes`) and "Disable" (a password dialog). For `role` owner or admin, the disable dialog shows the warning.
  - **Sessions:** the list. The current session is first with "This device" and no button; the others get "End". "End all others" opens a confirm. The list reloads after each action.
- **`two-factor.dialog`:** a state signal `'password' | 'scan' | 'codes'`.
  - **password → scan:** `startTwoFactor`.
  - **scan:** shows a QR of `totpURI` and the `secret` query parameter grouped by four. A 6-digit `confirmTwoFactor` moves it to **codes**.
  - **codes:**
    - "Copy" puts the codes on the clipboard, one per line (`navigator.clipboard.writeText`);
    - "Download" saves a Blob as `swarm-keeper-backup-codes.txt`;
    - "Done" closes the dialog.
  - **Closing in any state** clears `totpURI` and the codes.
- **`qr-code`** renders an SVG from a string with the chosen QR library, loaded with a dynamic `import()` inside the component.

- [ ] **Step 1: Failing tests:**
  - **`user-agent.spec.ts`:** these real agent strings:
    - Chrome on Windows;
    - Edge on Windows → `Edge`;
    - Firefox on Linux;
    - Safari on macOS;
    - Safari on iOS;
    - Chrome on Android;
    - Samsung Internet;
    - `null` and an empty string → both `null`.
  - **`two-factor.dialog.spec.ts`:**
    - a password step, then the scan step showing the grouped secret from `otpauth://totp/Swarm%20Keeper:x?secret=JBSWY3DPEHPK3PXP&issuer=Swarm%20Keeper` as `JBSW Y3DP EHPK 3PXP`;
    - a wrong code shows the error and stays on scan;
    - a right code shows the 8 codes from the fake;
    - **Review Focus 2:** closing after the password step leaves `confirmTwoFactor` uncalled, and the component's codes and URI signals are empty.
  - **`security.page.spec.ts`:**
    - a passkey-only user (`hasPassword: false`) sees no 2FA section;
    - a password user with 2FA off sees "Enable";
    - an owner's disable dialog shows the warning;
    - **Review Focus 5:** the current session row has no "End" button;
    - `SESSION_NOT_FRESH` from add opens the sign-in-again dialog, and confirming navigates to `/login?returnUrl=%2Fsettings%2Fsecurity`;
    - `LAST_SIGN_IN_METHOD` on delete shows its translated text;
    - no literal text in the templates.
- [ ] **Step 2:** Run the web tests. Expected: FAIL.
- [ ] **Step 3: Implement.** Install the QR library pinned; ledger the choice. Register any new icons in `ICONS`. Translations go in en and ru.
- [ ] **Step 4:** Run `pnpm --filter @swarm-keeper/web test && pnpm lint && pnpm typecheck && pnpm --filter @swarm-keeper/web build`. Expected: green; the QR library is in a lazy chunk, not the initial bundle.
- [ ] **Step 5: Commit** `feat(settings): add /settings/security with passkeys, 2FA and sessions`.

### Task 7: `feature-family`: `/family/members`

**Files:**
- Create the library `libs/web/features/family`:
  - `package.json` (`@swarm-keeper/feature-family`), `tsconfig.json`, `src/index.ts` (`FAMILY_ROUTES`);
  - `src/data-access/member-rules.ts`, `member-rules.spec.ts`;
  - `src/feature/members.page.ts` (+ html, scss, spec), `src/feature/invite.dialog.ts` (+ spec), `src/feature/family.routes.ts`;
  - `src/ui/role-badge.ts`.
- Modify:
  - `tsconfig.base.json`, the `angular.json` test include, `transloco.config.ts` (`scopePathMap.family`);
  - `app.routes.ts`: the shell child `family`;
  - `apps/web/src/i18n/family/{en,ru}.json`;
  - the root `errors.*`: `USER_IS_ALREADY_A_MEMBER_OF_THIS_ORGANIZATION`, `USER_IS_ALREADY_INVITED_TO_THIS_ORGANIZATION`, `YOU_ARE_NOT_ALLOWED_TO_INVITE_USER_WITH_THIS_ROLE`, `SINGLE_ROLE_REQUIRED`;
  - `tools/boundaries`: a forbidden case, feature-family → feature-settings.

**Interfaces:**
- `inviteRoles(actor: FamilyRole): FamilyRole[]`: for `owner` → `['owner', 'admin', 'member', 'viewer']`; for `admin` → `['admin', 'member', 'viewer']`.
- `canManage(actor: { userId; role }, member: { userId; role }): boolean`: `false` for oneself; an owner → `true`; an admin → `member.role !== 'owner'`; others → `false`.
- `isExpired(row: InvitationRow, now = new Date()): boolean`.
- **Members page:**
  - **Data:** `resource`s over `listMembers()` and `listInvitations()`, filtered to `status === 'pending'`. Both reload after invite, resend and cancel.
  - **Title:** "Members of the family «{family}»" (ICU `{family}`).
  - **When `twoFactorRequired()`:** the 2FA note with a link to `/settings/security` replaces "Invite", "Resend" and "Cancel".
  - **Member rows:** the ⋮ menu where `canManage`; both items open the snack-bar `family.notImplemented`.
  - **Invitation rows:** the email-language line, "Valid until {date}" or the "Expired" badge.
    - "Resend" calls `AuthService.resendInvitation(row)`, then shows the snack-bar "Invitation sent again".
    - "Cancel" opens a confirm, then calls `cancelInvitation`.
- **Invite dialog** (Signal Forms):
  - `email` (required, email);
  - `role` (from `inviteRoles(role())`, default `member`), with a description line per role;
  - `locale` (`en` | `ru`, default `user().locale`).
  - Errors show inline with their code texts; on success the dialog closes and the list reloads.

- [ ] **Step 1: Failing tests:**
  - **`member-rules.spec.ts`:**
    - **Review Focus 4:** `inviteRoles('admin')` does not contain `owner`, and `inviteRoles('owner')` does;
    - `canManage`: self → false; owner on admin → true; admin on owner → false; admin on member → true; member on viewer → false;
    - `isExpired` at the boundary.
  - **`members.page.spec.ts`:**
    - the owner's own row has no menu;
    - the ⋮ "Change role" shows `family.notImplemented`;
    - the expired row shows "Expired";
    - with `twoFactorRequired: true`, the note shows and the "Invite" button is absent;
    - **Review Focus 3:** "Resend" on an expired row, with the fake's `cancelInvitation` failing, still shows "Invitation sent again", and the list reloads;
    - no literal text.
  - **`invite.dialog.spec.ts`:**
    - an admin sees no Owner option;
    - the language defaults to the user's locale;
    - `USER_IS_ALREADY_INVITED_TO_THIS_ORGANIZATION` shows its text and keeps the dialog open.
- [ ] **Step 2:** Run the web tests. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4:** Run `pnpm --filter @swarm-keeper/web test && pnpm lint && pnpm typecheck`. Expected: green.
- [ ] **Step 5: Commit** `feat(family): add /family/members with invitations`.

### Task 8: 6a minors in `feature-auth` (2, 4, 6)

**Files:**
- Modify (all in `libs/web/features/auth/src/feature/`):
  - `invite.page.ts` (+ html, spec);
  - `apps/web/src/i18n/auth/{en,ru}.json`.

**Interfaces:**
- **Minor 2:** the invite page renders its form or its "Accept" state only after `auth.ready()`. Until then it shows the loading state.
- **Minor 4:** when `signUpPassword` fails after the account was created, the page switches to the state `'account-ready'`. That state shows a "Your account is ready, sign in" text and a link to `/login?returnUrl=%2Finvite%2F{token}`.
  - The account counts as created when `AuthService.signUpPassword` throws an `AuthError` with a sign-in code after the sign-up call succeeded. Extend `signUpPassword` to throw `AuthError('SIGNED_UP_SIGN_IN_FAILED')` in that case.
- **Minor 6:** the name field has `maxLength(64)` in the schema, and `NAME_TOO_LONG` gets error texts in en and ru.

- [ ] **Step 1: Failing tests** `invite.page.spec.ts`:
  - while `ready()` is false, neither the form nor "Accept" is rendered;
  - when `signUpPassword` rejects with `SIGNED_UP_SIGN_IN_FAILED`, the account-ready text and the login link with `returnUrl` appear;
  - a 65-character name keeps the submit disabled.
- [ ] **Step 2:** Run the web tests. Expected: FAIL.
- [ ] **Step 3: Implement**, including the `AuthService.signUpPassword` change and its spec in core.
- [ ] **Step 4:** Run `pnpm --filter @swarm-keeper/web test && pnpm lint`. Expected: green.
- [ ] **Step 5: Commit** `fix(auth): wait for the session on the invite page and recover from a half-done sign-up`.

### Task 9: Playwright scenarios and docs

**Files:**
- Create in `apps/web-e2e/tests/`: `security-two-factor.spec.ts`, `security-passkeys.spec.ts`, `security-sessions.spec.ts`, `members.spec.ts`.
- Modify:
  - `apps/web-e2e/support/api.ts`: `createMember` takes a `role`; add `mailpitMessages(to)`, if there is no such helper, reading `http://127.0.0.1:8025/api/v1/search?query=to:…`;
  - the docs:
    - `CLAUDE.md`, only if commands changed;
    - `docs/architecture/frontend.md`: the shell, `/settings/security`, `/family/members`, the icon registry;
    - `docs/architecture/authentication.md`: session routes, if not done in Task 2;
    - the roadmap: step 6 done.

**Scenarios** (each runs in `chromium-en` and `chromium-ru`, with UI texts read from the translation files as in 6a):
- **`security-two-factor`:**
  - a new admin is created with a password through the API;
  - `/family/members` shows the 2FA note;
  - on `/settings/security` the admin enables 2FA, reading the secret from the dialog and computing the TOTP with `support/totp.ts`;
  - the codes step shows 8 codes;
  - after "Done", `/family/members` shows "Invite".
- **`members`:**
  - the owner (2FA from `owner.setup.ts`) invites `uniqueEmail()` with language `ru` in the en project and `en` in the ru project;
  - Mailpit has one email to that address with the chosen language's subject;
  - "Resend" makes Mailpit hold two emails;
  - "Cancel" removes the row;
  - an invitation expired by SQL can be resent: a new email arrives, and the "Expired" row is gone;
  - a member's ⋮ "Change role" shows the "Not implemented yet" snack-bar.
- **`security-passkeys`:**
  - a passkey-only user signs up from an invitation (reuse the 6a flow) and opens `/settings/security`;
  - they add a second passkey on the virtual authenticator, rename it, delete it;
  - deleting the remaining one shows the last-sign-in-method message, and the key is still listed.
- **`security-sessions`:**
  - one user signs in from two browser contexts;
  - context A ends B's session;
  - B's next navigation to `/settings/security` lands on `/login`.

- [ ] **Step 1:** Write the scenarios.
- [ ] **Step 2:** Run `pnpm e2e` (needs `pnpm infra:up`). Expected: the new scenarios pass in both projects, and the 6a scenarios still pass.
- [ ] **Step 3:** Update the docs, then run `pnpm lint && pnpm typecheck && pnpm test`. Expected: green.
- [ ] **Step 4: Commit**
  - `test(e2e): cover security settings and family members in en and ru`;
  - then `docs: describe security settings, members and icons`.
