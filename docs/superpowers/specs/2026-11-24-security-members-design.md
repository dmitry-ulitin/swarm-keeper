# Security settings, family members and icons (step 6b) design

November 24, 2026. Status: approved. Step 6, part b, of `docs/superpowers/roadmaps/2026-11-23-better-auth-roadmap.md`. Part a is `docs/superpowers/specs/2026-11-24-auth-web-design.md` (merged, PR #9).

## Intent

After 6a people can sign up and sign in, but nobody can invite them from the web:
- an owner who has a password needs 2FA before any admin action (step 3b), and there is no screen to turn it on;
- there is no screen to send an invitation at all.

6b closes that gap, so the owner can start inviting the family:
- `/settings/security`, where any signed-in person manages their passkeys, 2FA and sessions;
- `/family/members`, where owners and admins see the family, send invitations, resend and cancel them.

It also replaces the 5.4 MB icon font with SVG icons and fixes the minors deferred from 6a.

## Scope

**Goals:**
- **App shell:** a minimal header for signed-in screens, with a user menu holding "Security", "Members" and "Sign out".
- **`/settings/security`:**
  - passkeys: list, add, rename, delete;
  - 2FA: enable, show backup codes once, generate new codes, disable;
  - sessions: list, end one, end all others.
- **`/family/members`:**
  - the members list and the invitations list;
  - the invite dialog;
  - "Resend" and "Cancel" on invitations;
  - "Change role" and "Remove" present but stubbed.
- **API:**
  - the server refuses to delete a person's last sign-in method;
  - our own session routes under `/api/v1/me/sessions` (list, end one, end all others);
  - the fresh-session check for adding a passkey runs before the browser prompt.
- **Icons:** SVG icons from `@material-symbols/svg-400` instead of the `material-symbols` font.
- **6a deferred minors:** all six (listed below).
- **Tests:** Playwright in `en` and `ru` for both screens.

**Non-goals:**
- Changing a member's role and removing a member. These need the retention rules for private files and `audit_event`, which arrive with the archive. In 6b they are menu items that show "Not implemented yet".
- The family switcher, real home page, archive navigation and `/settings/appearance`.
- Changing or setting a password.
- Recovery links from an admin.
- `audit_event` rows for invitations (the table does not exist yet).

**Anti-goals:**
- **A person locked out of their own account by this screen.** Examples: deleting the last passkey with no password, or ending the current session without noticing.
- **Backup codes or the TOTP secret leaking.** They must not be logged, stored in the browser, or shown again after the dialog closes.
- **Stub buttons for actions the person could never do.** For example, an admin must not see "Change role" on an owner.
- **Any literal text in templates, raw colors or px in styles.**

## Decided by the owner

- **Members screen: the full layout now, two actions stubbed.**
  - "Change role" and "Remove" are in each member's ⋮ menu and show a snack-bar "Not implemented yet".
  - The person's own row has no menu.
- **`/family/members` layout:**
  - **Who sees it:** owners and admins.
  - **Title and button:** "Members of the family «…»" and an "Invite" button.
  - **Members section:** name, email, role badge, joined date.
  - **Invitations section:**
    - shows pending invitations: email, role, email language, valid-until date;
    - an expired invitation shows the "Expired" badge;
    - every invitation has the actions "Resend" and "Cancel";
    - resend works on an expired invitation too.
- **Invite dialog:** email, role and email language. The language defaults to the inviter's own.
  - **Role:** only an owner sees "Owner" in the list.
- **Without the required 2FA,** the page shows a note "To invite and manage members, turn on two-factor authentication" with a link to `/settings/security` instead of the "Invite" button and the invitation actions.
- **`/settings/security`: three sections.**
  - **Passkeys:**
    - a list with name and date added, and "Rename" and "Delete" per key;
    - an "Add passkey" button;
    - adding needs a fresh session. If the session is older than a day, a dialog says "Sign in again" with a button that signs out and returns to this page after sign-in.
    - deleting the last sign-in method is refused, with the message "This is your last way to sign in…".
  - **Two-factor authentication:**
    - shown only to people who have a password;
    - **enabling** is three steps in one dialog: the password; a QR code, the secret as text and a 6-digit code; then the backup codes, shown once, with "Copy", "Download" and "Done";
    - **when on:** "New backup codes" and "Disable", both with the password;
    - **disabling as an owner or admin** is allowed, after a warning that inviting and managing members stops working without 2FA.
  - **Sessions:**
    - a list with device and browser (from the user agent), IP and last activity;
    - "This device" on the current one;
    - "End" on each of the others, and "End all others".
- **Header:** the app name, and an avatar with the user menu. "Members" appears only for owners and admins.
- **Approaches:** Better Auth routes for the members data, our own routes for sessions, SVG icons (see below).
- **The 6a minors are all fixed in 6b.**
- **Mockup:** `docs/design/mockups/settings/members-security.html`. The screens follow it.

## Approaches

**Members data**

| | Approach | Trade-off |
| --- | --- | --- |
| **A (chosen)** | The browser calls Better Auth's organization routes: `list-members`, `list-invitations`, `invite-member` (with `resend: true`), `cancel-invitation`. | No new API. The 2FA and single-role checks (step 3b) already guard these routes, and the native app will use them too. The responses are not in our OpenAPI. |
| B | Our own `GET /api/v1/family/members` for the read side, with Better Auth for the changes. | Same data in our contract, but more code and two ways to read the same thing. |

**Sessions**

Better Auth's `list-sessions` sits behind `freshSessionMiddleware`: it answers `SESSION_NOT_FRESH` once the session is older than `freshAge` (one day). Sessions live 30 days, so most visits would fail. It also returns every session's token, and with the bearer plugin on, each token is a working credential.

| | Approach | Trade-off |
| --- | --- | --- |
| **A (chosen by the owner)** | Our own `GET /api/v1/me/sessions`, `DELETE /api/v1/me/sessions/:id` and `DELETE /api/v1/me/sessions` (all others). They answer with session ids, never tokens. | Works from any session age. No tokens reach the browser. The routes are in our OpenAPI, so the native app can use them. Costs a small API module. |
| B | Better Auth's routes, with a "Sign in again" dialog when the session is stale. | No new API, but nearly every visit asks for a sign-in, and the tokens still reach the browser. |
| C | Turn off `freshAge`. | Weakens the passkey-add rule kept in 6a. |

**Icons**

| | Approach | Trade-off |
| --- | --- | --- |
| **A (chosen)** | SVG icons from `@material-symbols/svg-400` (rounded, outline), registered by name with `MatIconRegistry`. | Only registered icons ship, a few hundred bytes each. No font and no Python tooling. A new icon must be registered, and `fontIcon="x"` becomes `svgIcon="x"`. |
| B | A font subset made with fontTools (Python): one static instance with only our icons, committed. | Call sites stay the same, but it adds a Python tool and a rebuild step per icon. The ligature table also needs manual pruning, because a subset by letters keeps every icon. |
| Rejected | The Google Fonts CDN with `icon_names`. | The app is self-hosted; no third-party requests. |

## How it works

### App shell

- **Where:** a shell component in `apps/web` wraps every signed-in route:
  - the header on top, the routed page below;
  - `authGuard` sits on the shell route;
  - the 6a placeholder home page moves under it.
- **User menu:**
  - the name and email;
  - "Security" (`/settings/security`);
  - "Members" (`/family/members`, through `*skCan="'member:create'"`);
  - "Sign out".
- **Signed-out screens** (`/login`, `/invite/:token`, `/reset-password`) keep the card layout from 6a, with no header.

### Features and boundaries

- **New features:**
  - `@swarm-keeper/feature-settings` (`libs/web/features/settings`) holds `/settings/security`;
  - `@swarm-keeper/feature-family` (`libs/web/features/family`) holds `/family/members`.
- **Each feature** has:
  - the `data-access`, `feature` and `ui` layers;
  - its own `i18n/<feature>/{en,ru}.json` scope;
  - an entry in the keys-manager and `ng test` input lists (6a ruling: those lists are explicit).
- **Calls to Better Auth** go through `AuthService` and `AuthClientPort` in `libs/web/core`, which grows the methods below. Features never import the Better Auth client directly.
- **Routes:**
  - `/settings/security`: `authGuard`;
  - `/family/members`: `authGuard`, `familyGuard` and `permissionGuard('member', 'create')`.
- **The interceptor's** `TWO_FACTOR_REQUIRED → /settings/security` now has a real target.

### `/family/members`

- **Data:**
  - `listMembers` and `listInvitations` for the active family.
  - Invitations are filtered on the client to `status === 'pending'`.
  - An invitation is expired when `expiresAt` is in the past.
  - Both lists reload after every change.
- **Invite:**
  - **Request:** `invite-member` with `{ email, role, organizationId, locale }`.
  - **Roles:** `admin`, `member`, `viewer`; `owner` only when the caller is an owner. Each role has a one-line description from the translations.
  - **Language:** `en` or `ru`, defaulting to the inviter's `locale`.
  - **Errors** are shown inline as codes:
    - `USER_IS_ALREADY_A_MEMBER_OF_THIS_ORGANIZATION`;
    - `USER_IS_ALREADY_INVITED_TO_THIS_ORGANIZATION`;
    - `TWO_FACTOR_REQUIRED`;
    - `SINGLE_ROLE_REQUIRED`;
    - `YOU_ARE_NOT_ALLOWED_TO_INVITE_USER_WITH_THIS_ROLE`.
- **Resend:**
  - **Still valid:** `invite-member` with `resend: true`, the same email and the same role. Better Auth extends the expiry and sends the email again.
  - **Expired:** Better Auth does not count it as pending, so `resend: true` would create a second invitation. The client therefore sends a new invitation with the same email, role and locale, then cancels the expired one. If the cancel fails, the expired row stays visible and can be cancelled by hand. The new invitation is what matters.
  - **After either:** a snack-bar "Invitation sent again".
- **Cancel:** `cancel-invitation`, after a confirm dialog.
- **Member menu (⋮):**
  - the items are "Change role" and "Remove from family", both showing a snack-bar "Not implemented yet";
  - shown only where the future action would be allowed: an owner sees it on every other member, an admin on every other member who is not an owner;
  - no menu on the person's own row.
- **2FA note:** shown when `GET /me` says `twoFactorRequired`. In that state "Invite", "Resend" and "Cancel" are hidden, because the server would refuse them.
- **Display:**
  - names, and the email in a second line;
  - dates through `Intl.DateTimeFormat` in the UI language;
  - the role through the `RoleBadge` design;
  - long names and emails wrap, and rows wrap on narrow screens.

### `/settings/security`

**Passkeys**
- **List:** `passkey/list-user-passkeys`, showing the name (or "Passkey" when empty) and the date added.
- **Add:** `addPasskey` from 6a's `AuthService`, then the browser prompt.
  - The default name is the browser and OS from the user agent, for example "Chrome · Windows".
  - `SESSION_NOT_FRESH` opens the "Sign in again" dialog, which signs out and goes to `/login?returnUrl=/settings/security`.
  - If the person cancels the browser prompt, nothing happens.
- **Rename:** `passkey/update-passkey`, in a dialog with one field (required, at most 64 characters).
- **Delete:** `passkey/delete-passkey`, after a confirm dialog.
  - The server refuses with 400 `LAST_SIGN_IN_METHOD` when this is the person's only passkey and they have no password (`credential` account).
  - The check is a `hooks.before` on `/passkey/delete-passkey` in the identity module, next to the 2FA hook.
  - The client does not pre-check or hide the button: it shows the server's refusal as a message. The server is the only check, so a second tab can't race past it.

**Two-factor authentication**
- **Shown** only when the person has a password.
  - `GET /me` gains `user.hasPassword: boolean`; the additive change is allowed within v1.
  - People without a password see nothing here: when they sign in with a passkey, no code is asked.
- **Enable:**
  1. `two-factor/enable` with the password returns `totpURI` and `backupCodes`.
  2. The dialog renders `totpURI` as a QR code on the client and shows the secret from the URI, grouped by four. The person enters a code; `two-factor/verify-totp` turns 2FA on (Better Auth's default `skipVerificationOnEnable: false`).
  3. The backup codes from step 1 are shown:
     - "Copy" puts them on the clipboard;
     - "Download" saves `swarm-keeper-backup-codes.txt`;
     - "Done" closes the dialog.

  Closing the dialog before step 3 leaves 2FA off. The codes live only in the dialog's signals and are gone when it closes.
- **When on:**
  - a "Turned on" badge;
  - **"New backup codes":** `two-factor/generate-backup-codes` with the password; the codes are shown once, as in step 3.
  - **"Disable":** `two-factor/disable` with the password. For owners and admins the dialog warns that inviting and managing members stops working.
  - There is no count of remaining backup codes: Better Auth 1.7.27 exposes it only on a server-only route, so the mockup's "8 left" is dropped.
- **After each change,** `AuthService.refresh()` reloads `/me`, so `twoFactorRequired` and the members screen update.
- **Errors:** a wrong password and a wrong code show their codes' texts inline.

**Sessions**
- **List:** `GET /api/v1/me/sessions` (below):
  - device and browser parsed from `userAgent` on the client: a small parser of our own, no dependency;
  - IP, or "Unknown" when there is none;
  - last activity (`updatedAt`): a relative time for today, otherwise a date.
- **Order and current session:** the current session is first, marked "This device", with no "End" button.
- **End:** `DELETE /api/v1/me/sessions/:id`.
- **End all others:** `DELETE /api/v1/me/sessions`, after a confirm dialog.
- **After either,** the list reloads.

### API: sessions

- **Where:** a controller in the identity module; every route needs a session (no `@AllowAnonymous()`).
- **`GET /api/v1/me/sessions`:**
  - returns the caller's sessions that have not expired;
  - each item is `{ id, userAgent, ipAddress, createdAt, updatedAt, current }`, newest activity first;
  - `current` marks the session making the request.
  - It never returns `token`.
- **`DELETE /api/v1/me/sessions/:id`:**
  - deletes the caller's session with that id and answers 204;
  - another user's session or an unknown id gives 404 `SESSION_NOT_FOUND` (no difference between the two);
  - the current session gives 400 `CURRENT_SESSION` (signing out is the way to end it).
- **`DELETE /api/v1/me/sessions`:** deletes all the caller's sessions except the current one and answers 204.
- **How:**
  - the routes delete the `session` rows directly (`cookieCache` is off, so the change takes effect at once);
  - bearer tokens are session tokens, so a phone signed in with that session is signed out too.
- **Docs:** `authentication.md` gains the routes and the error codes.

### API: adding a passkey from a stale session

- **Where the check runs today:** in `afterVerification` (6a). That runs after the person touches the authenticator, so the device keeps a discoverable passkey the server never stored, and that key fails on every later sign-in.
- **The change:** a `hooks.before` on `/passkey/generate-register-options` refuses with 403 `SESSION_NOT_FRESH` when a session exists and is older than `freshAge`. Anonymous sign-up from an invitation has no session and is not affected.
- **The check in `afterVerification`** stays as the backstop.
- **Test:** an integration test with a two-day-old session gets 403 from `generate-register-options`.

### API change: last sign-in method

- **Rule:**
  - a `hooks.before` matcher on `/passkey/delete-passkey` loads the session, the passkey being deleted and the user's passkey count;
  - if the passkey belongs to the user, it is their only one, and `hasPassword` is false, the hook throws `APIError('BAD_REQUEST', { code: 'LAST_SIGN_IN_METHOD' })`;
  - a passkey that is not the caller's is left to the plugin's own ownership check.
- **Accepted race:** the check and the delete are not atomic. Two deletes of a user's last two passkeys at the same moment, from two tabs, could both pass. The cost is a locked-out account, recovered by an admin recovery link or the server script. Making it atomic (a lock held through the plugin's delete, or a trigger) is not worth it for this case.
- **Error code and docs:** the code joins the list in `authentication.md`.
- **Integration tests:**
  - refuses deleting the only passkey of a passkey-only account;
  - allows deleting it when a password exists;
  - allows deleting one of two.

### `GET /me`

- **`user.hasPassword`:** the user has a `credential` account. It reuses `hasPassword` from step 3b.
- **Compatibility:** an additive field, so OpenAPI only gains a property. Its test goes in the existing `/me` spec.

### Icons

- **Package:** add `@material-symbols/svg-400` (pinned, the same version line as `material-symbols`, 0.49.0).
- **Remove the font:** remove `material-symbols` and its `rounded.css` from `angular.json` and the font-set setup in `app.config.ts`.
- **Registry:** one file in `libs/web/ui`, `provideIcons()`, maps names to the rounded outline SVG sources. It imports each SVG as text, through the esbuild `loader` option `".svg": "text"` in `angular.json`, and registers it with `MatIconRegistry.addSvgIconLiteral`. These are trusted local strings, so they go through `DomSanitizer.bypassSecurityTrustHtml`.
- **Call sites:** templates use `<mat-icon svgIcon="…">`. The existing `fontIcon="upload"` in the foundations showcase moves to the new form.
- **Check:** a unit test asserts that every `svgIcon="…"` literal in `apps/web/src` and `libs/web` is registered.
- **Docs:** `frontend.md` and `docs/design/README.md` (if it mentions the font) describe the registry.
- **Budget:** the production build no longer contains a `.woff2` from `material-symbols`.

### 6a deferred minors

1. **Interceptor exclusion:** the 401 exclusion for `/api/v1/me` becomes an exact path match, so `/api/v1/members…` is not exempt.
2. **Invitation page:** `/invite/:token` waits for `AuthService.ready()` before choosing between the sign-up form and "Accept invitation".
3. **`/me` errors:** only a 401 from `/me` means signed out. A 5xx or a network error keeps the previous state and shows the generic error, so a server restart does not log anyone out on screen.
4. **Half-done password sign-up:** if `signUpPassword` creates the account but the sign-in after it fails, the invite page switches to "Your account is ready, sign in" with a link to `/login?returnUrl=/invite/:token`, instead of leaving the form that would answer `USER_ALREADY_EXISTS`.
5. **`guestGuard`:** a signed-in user on `/login?returnUrl=…` goes to the safe `returnUrl` (via `safeReturnUrl`), not `/`.
6. **Passkey sign-up name:** at most 64 characters on both the server (`NAME_REQUIRED` covers empty; a new `NAME_TOO_LONG` covers too long) and the form.
7. **After-hook test:** a test pins that the invite-only after-hook does nothing on the passkey path.

## Testing

- **Unit (Vitest):**
  - the `AuthService` additions;
  - the user-agent parser (Chrome, Firefox, Safari, Edge on Windows, macOS, iOS, Android and Linux; an unknown agent);
  - the role options in the invite dialog for an owner and for an admin;
  - which member rows get a menu;
  - the expired-resend sequence (a new invitation, then cancelling the old one);
  - the 2FA dialog steps and that the codes are cleared on close;
  - the icon registry check;
  - each of the 6a minors.
- **API integration:**
  - the three `LAST_SIGN_IN_METHOD` cases;
  - the sessions routes: list without tokens and with `current`, a stale (two-day-old) session can still list, ending one, `SESSION_NOT_FOUND` for another user's session, `CURRENT_SESSION`, ending all others;
  - `SESSION_NOT_FRESH` from `generate-register-options`;
  - `user.hasPassword` in `/me`;
  - `NAME_TOO_LONG`.
- **Playwright, in `chromium-en` and `chromium-ru`:**
  - **A new admin with a password:** they see the 2FA note on `/family/members`, then enable 2FA on `/settings/security` with a TOTP from the secret, and the note is gone.
  - **The owner invites a person:**
    - the email appears in Mailpit in the chosen language;
    - "Resend" sends a second email;
    - "Cancel" removes the row;
    - an expired invitation (made through SQL) can be resent and gets a new email.
  - **A passkey-only user:**
    - adds a second passkey and renames it;
    - deletes it;
    - deleting the last one is refused with the message.
  - **Sessions:** a user signed in from two contexts ends the other session, and the other context is sent to `/login` on its next request.
  - **The member menu:** "Change role" shows "Not implemented yet".

## Left to the builder

- The QR library: small, with no runtime dependencies, rendering SVG, loaded lazily inside the 2FA dialog. Pin it exactly.
- The exact copy, within the glossary and the formal «вы».
- How the user-agent parser is laid out, as long as the tests above hold.
- Component split inside each feature.
- Whether the "Sign in again" flow reuses the interceptor's return-url helper or its own call to `safeReturnUrl`.
