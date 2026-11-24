# Multi-family hosting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Operator commands that create a family and invite its owner by email, resend that invitation and list families; docs that describe one installation serving several families on any host.

**Architecture:** An operator service in `apps/api/src/modules/identity` (it owns `organization`, `member`, `invitation`) writes rows with Kysely, the way `seedOwner` does, and mails through the existing `Mailer`. A thin CLI entry `apps/api/src/family.ts`, built like `seed.ts`, parses arguments and calls the service. Acceptance reuses the existing invitation flow unchanged.

**Tech Stack:** NestJS API sources run as a Node script, Kysely, Better Auth 1.7.27 tables, nodemailer via `SmtpTransport`, Vitest with Postgres and Mailpit, `node:util` `parseArgs`.

**Spec:** `docs/superpowers/specs/2026-11-24-multi-family-hosting-design.md`

## Global Constraints

- No operator-set passwords; the owner's email is verified only by the invitation link (existing invite-only flow, unchanged).
- The invite-only `user.create.before` hook and the four mandatory auth tests stay untouched.
- Owner invitations: role `owner`, `ui_size` `compact`, locale `en` or `ru` (default `en`), expiry 7 days — the same value as Better Auth's `invitationExpiresIn`.
- Invitation URL: `${authEnv().baseURL}/invite/${invitation.id}`, as in `create-auth.ts`.
- Inviter: the account named by `OPERATOR_EMAIL` (or `--inviter`); it must exist with `email_verified = true`.
- Errors are codes (`OperatorError.code`), not prose; the CLI prints the code plus a short English hint.
- `pnpm db:seed` keeps its behavior (once per installation).
- No new dependencies. Everything in English; no Russian outside `ru` files and the glossary.
- Commits follow Conventional Commits and end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. The invitation email fails to send after the rows are committed: the family and pending invitation stay, the service throws `INVITATION_NOT_SENT` with the slug, and `reinviteFamilyOwner` then works for it (Task 1).
2. An owner email with capitals or spaces (`"  Ivan@Example.TEST "`) is stored trimmed and lowercased, so the invitee's sign-up matches (Task 1).
3. A second family with the same name gets a distinct slug (`the-ivanovs-2`) instead of failing on the unique index (Task 1).
4. The owner email already has an account in another family: they accept with `/organization/accept-invitation`, become owner of the new family and stay in the old one (Task 1).
5. Reinviting after the first invitation expired or was never accepted: older pending owner invitations are canceled, so the old link stops working (Task 1).

---

### Task 1: Operator service

**Files:**
- Create: `apps/api/src/modules/identity/family-slug.ts`
- Create: `apps/api/src/modules/identity/family-operator.ts`
- Create: `apps/api/src/modules/identity/family-operator.spec.ts`
- Modify: `apps/api/src/modules/identity/seed-owner.ts` (use `uniqueFamilySlug`, drop local `slugify`)
- Modify: `apps/api/src/modules/identity/create-auth.ts` (export `INVITATION_EXPIRES_IN`, use it for `invitationExpiresIn`)
- Modify: `apps/api/src/modules/identity/index.ts` (export the new API and `SmtpMailer`)

**Interfaces:**
- Produces:
  - `uniqueFamilySlug(db: Database | Transaction<DB>, name: string): Promise<string>` — the existing `slugify` + `-2`, `-3`… suffix loop moved out of `seedOwner`.
  - `INVITATION_EXPIRES_IN: number` (seconds, `7 * DAY`) in `create-auth.ts`.
  - `class OperatorError extends Error { constructor(readonly code: OperatorErrorCode, readonly params: Record<string, string> = {}) }`
  - `type OperatorErrorCode = 'OPERATOR_NOT_FOUND' | 'OPERATOR_UNVERIFIED' | 'INVALID_EMAIL' | 'INVALID_LOCALE' | 'FAMILY_NOT_FOUND' | 'FAMILY_HAS_OWNER' | 'OWNER_EMAIL_REQUIRED' | 'INVITATION_NOT_SENT'`
  - `interface OperatorDeps { db: Database; mailer: Mailer; baseURL: string }`
  - `createFamilyForOwner(deps: OperatorDeps, input: { name: string; ownerEmail: string; locale?: string; operatorEmail: string }): Promise<{ familyId: string; slug: string; invitationId: string }>`
  - `reinviteFamilyOwner(deps: OperatorDeps, input: { familySlug: string; ownerEmail?: string; operatorEmail: string }): Promise<{ invitationId: string; email: string }>`
  - `listFamilies(db: Database): Promise<FamilySummary[]>` with `interface FamilySummary { slug: string; name: string; owners: string[]; members: number; pendingOwnerInvitation: { email: string; expiresAt: Date } | null }`, ordered by `createdAt`.
- Naming note: the spec says `createFamily`; `testing.ts` already exports a `createFamily` helper, so the service is `createFamilyForOwner`.

- [ ] **Step 1: Write the failing tests** in `family-operator.spec.ts`, using `startAuthApp`, `createUser`, `createFamily`, `uniqueEmail`, `clientIp` from `testing.ts`. A recording fake `Mailer` collects `invitation` calls; one test uses the real `new SmtpMailer(new SmtpTransport(mailEnv()))` and `latestMailTo`. `operatorEmail` is a verified user from `createUser`.

```ts
it('creates a family with a pending owner invitation and mails it in the requested language')
  // real SmtpMailer; name 'Ивановы', locale 'ru'
  // organization row: name 'Ивановы'; no member rows for it
  // invitation: role 'owner', status 'pending', locale 'ru', uiSize 'compact',
  //   inviterId = operator id, expiresAt within 7 days ± 1 min of now
  // (await latestMailTo(ownerEmail)).subject === 'Приглашение в семью «Ивановы»'
  //   and its text contains `${baseURL}/invite/${invitationId}`

it('normalizes the owner email')            // '  Ivan@Example.TEST ' → invitation.email 'ivan@example.test'
it('gives a second family with the same name its own slug')  // slugs 'the-ivanovs…' differ
it('lets the invitee sign up from the invitation and become the owner')
  // POST /api/auth/sign-up/email { email, password, name, inviteToken: invitationId } → 200
  // member row: role 'owner' in the new family; user.emailVerified true
it('lets an existing member of another family accept and become the owner')
  // user from createFamily(db) (owner elsewhere) + session via internalAdapter.createSession
  // POST /api/auth/organization/accept-invitation { invitationId } → 200
  // member rows: owner in both families
it('fails without creating anything when the operator is unknown or unverified')
  // OPERATOR_NOT_FOUND / OPERATOR_UNVERIFIED; organization count unchanged
it('rejects a malformed owner email and an unknown locale')  // INVALID_EMAIL, INVALID_LOCALE; nothing created
it('keeps the family and reports INVITATION_NOT_SENT when the email fails')
  // mailer.invitation rejects → OperatorError code 'INVITATION_NOT_SENT', params.slug set;
  // family and pending invitation exist; reinviteFamilyOwner with a working mailer then succeeds
it('reinvites: cancels older pending owner invitations and reuses their email')
  // after create, reinvite without ownerEmail → new invitation for the same email;
  // old row status 'canceled'; findPendingInvitationById(db, oldId) is undefined
it('reinvites after the invitation expired')  // set expiresAt in the past; reinvite works
it('refuses to reinvite once the family has an owner')        // FAMILY_HAS_OWNER
it('needs an owner email when the family never had an owner invitation')  // OWNER_EMAIL_REQUIRED
it('reports FAMILY_NOT_FOUND for an unknown slug')
it('lists families with owners, member counts and the pending owner invitation')
```

- [ ] **Step 2: Run them to see them fail**

Run: `pnpm --filter @swarm-keeper/api exec vitest run src/modules/identity/family-operator.spec.ts`
Expected: FAIL — `family-operator.js` not found.

- [ ] **Step 3: Implement `family-slug.ts`, `INVITATION_EXPIRES_IN`, and `family-operator.ts`**

- Validation before any write: email after `trim().toLowerCase()` must match `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`; locale ∈ `en | ru`; the operator is looked up by lowercased email.
- `createFamilyForOwner`: one transaction inserts `organization` (`uniqueFamilySlug`, `createdAt: now`) and `invitation`; after commit, `mailer.invitation({ email, url, locale, inviterName: operator.name, familyName: name, expiresAt })`. A rejected send becomes `OperatorError('INVITATION_NOT_SENT', { slug })` (cause attached).
- `reinviteFamilyOwner`: refuse with `FAMILY_HAS_OWNER` if a `member` row with role `owner` exists; email = given one, else the newest owner invitation's email (any status), else `OWNER_EMAIL_REQUIRED`; in one transaction set `status = 'canceled'` on the family's `pending` owner invitations and insert the new one; then mail as above.
- `seedOwner` calls `uniqueFamilySlug(trx, input.familyName)`; its spec must still pass unchanged.

- [ ] **Step 4: Run the tests**

Run: `pnpm --filter @swarm-keeper/api exec vitest run src/modules/identity/`
Expected: PASS, including `seed-owner.spec.ts` and `sign-up.spec.ts`.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/identity
git commit -m "feat(api): operator service to create families and invite their owners"
```

### Task 2: `family` CLI and scripts

**Files:**
- Create: `apps/api/src/family-command.ts` (pure argument parsing)
- Create: `apps/api/src/family-command.spec.ts`
- Create: `apps/api/src/family.ts` (entry, like `seed.ts`)
- Modify: `apps/api/package.json`, `package.json` (root), `.env.example`

**Interfaces:**
- Consumes: `createFamilyForOwner`, `reinviteFamilyOwner`, `listFamilies`, `OperatorError`, `SmtpMailer` from `./modules/identity/index.js`; `SmtpTransport`, `mailEnv` from `./modules/mail/index.js`; `authEnv`, `createDatabase`, `databaseUrl`.
- Produces: `parseFamilyCommand(argv: string[], env: NodeJS.ProcessEnv): FamilyCommand` where
  `type FamilyCommand = { kind: 'create'; name: string; ownerEmail: string; locale: string; operatorEmail: string } | { kind: 'invite-owner'; familySlug: string; ownerEmail?: string; operatorEmail: string } | { kind: 'list' }`; throws `UsageError` (message = usage text) on a missing or unknown argument.

- [ ] **Step 1: Write the failing tests** in `family-command.spec.ts`

```ts
it('parses create')   // ['create','--name','Ивановы','--owner-email','a@b.c','--locale','ru'], env {OPERATOR_EMAIL:'op@x.y'}
                      // → { kind:'create', name:'Ивановы', ownerEmail:'a@b.c', locale:'ru', operatorEmail:'op@x.y' }
it('defaults the locale to en')
it('lets --inviter override OPERATOR_EMAIL')
it('parses invite-owner with and without --owner-email')  // ['invite-owner','--family','the-ivanovs']
it('parses list without needing an operator')              // ['list'], env {} → { kind:'list' }
it('throws UsageError for a missing --name, a missing operator, an unknown subcommand or flag')
```

- [ ] **Step 2: Run them to see them fail**

Run: `pnpm --filter @swarm-keeper/api exec vitest run src/family-command.spec.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `family-command.ts` and `family.ts`**

- `parseFamilyCommand` uses `parseArgs` from `node:util` with `strict: true`, subcommand = first positional.
- `family.ts`: builds `{ db, mailer: new SmtpMailer(new SmtpTransport(mailEnv())), baseURL: authEnv().baseURL }`, runs the command, prints a one-line result (`Created family "<name>" (<slug>); invitation sent to <email>`) or a table for `list` (`console.table` of slug, name, owners joined by `, `, members, pending invitation email and date). On `OperatorError` it prints `<code>` plus a hint (for `INVITATION_NOT_SENT`: `run pnpm family:invite-owner --family <slug>`) and exits 1; on `UsageError` prints usage and exits 2. Always `db.destroy()`.
- Scripts in `apps/api/package.json`: `"family": "pnpm build && node dist/apps/api/src/family.js"`; root `package.json`: `"family:create": "pnpm --filter @swarm-keeper/api family create"`, `"family:invite-owner": "pnpm --filter @swarm-keeper/api family invite-owner"`, `"family:list": "pnpm --filter @swarm-keeper/api family list"`.
- `.env.example`: `# OPERATOR_EMAIL=owner@example.test` with a one-line comment (inviter for family:create and family:invite-owner).

- [ ] **Step 4: Verify**

Run: `pnpm --filter @swarm-keeper/api exec vitest run src/family-command.spec.ts` → PASS.
Then, with `pnpm infra:up` and a seeded dev DB: `NODE_ENV=development OPERATOR_EMAIL=owner@example.test pnpm family:create --name "Smoke" --owner-email smoke@example.test` prints the created line and the email shows in Mailpit (http://127.0.0.1:8025); `NODE_ENV=development pnpm family:list` shows the family with its pending invitation; `pnpm family:create --name X` (no email) exits 2 with usage.

- [ ] **Step 5: Run the full checks and commit**

Run: `pnpm typecheck && pnpm lint && pnpm --filter @swarm-keeper/api test` → all pass (Sheriff accepts `src/family.ts` importing barrels only).

```bash
git add apps/api/src/family.ts apps/api/src/family-command.ts apps/api/src/family-command.spec.ts apps/api/package.json package.json .env.example
git commit -m "feat(api): family:create, family:invite-owner and family:list commands"
```

### Task 3: Docs

**Files:**
- Modify: `README.md` (line 5 and the "Deployment" row)
- Modify: `CLAUDE.md` (project line, local-infrastructure sentence, commands block)
- Modify: `docs/architecture/authentication.md` ("How a new member joins" step 1, new "Operator" section, CVE-2026-45364 row)
- Modify: `docs/architecture/backend.md` (sections 5 and 7)

- [ ] **Step 1: Edit the docs**

- `README.md` line 5: "A family archive you run yourself: one installation serves several families, on your own server or in the cloud." "Deployment" row: "Undecided (the apps run anywhere Node, PostgreSQL and S3-compatible storage do)".
- `CLAUDE.md`: project line gets the same wording; "Whether there will be a self-hosted deployment stack is undecided" → "The production deployment stack is undecided"; the `db:*` block gains `pnpm family:create --name <name> --owner-email <email> [--locale en|ru]`, `pnpm family:invite-owner --family <slug> [--owner-email <email>]`, `pnpm family:list` with a one-line note that they need `OPERATOR_EMAIL` (the inviter's verified account) and send real email over SMTP.
- `authentication.md` step 1: "`pnpm db:seed` creates the first owner and family once per installation; every other family is created by the operator with `pnpm family:create`, which mails an owner invitation." New section **Operator**: the person who runs the installation; creates families and resends owner invitations from the command line; sets no passwords; has server-side access to every family's data because encryption is server-side (SSE), not end-to-end; operator actions go to `audit_event` once that table exists. CVE row: "the reverse proxy" instead of "Caddy".
- `backend.md` section 5: `blob_derivative` gains `size`; a paragraph **Storage usage**: a family's usage is `sum(blob.size) + sum(blob_derivative.size)` over its rows, each stored object counted once (deduplicated bytes; trash counts until purged; derivatives reported separately); `family_id` indexes on both; a `SUM` query for now, a per-family counter maintained in the blob transaction when quotas arrive. Section 7 item 2: "…from day one; one installation serves several families."

- [ ] **Step 2: Verify**

Run: `grep -rn -i "self-hosted" README.md CLAUDE.md docs/architecture` → only the SSO open question remains ("other self-hosted services"). Run `pnpm format` then `pnpm lint` → pass.

- [ ] **Step 3: Commit**

```bash
git add README.md CLAUDE.md docs/architecture
git commit -m "docs: one installation for several families, operator commands, storage usage"
```
