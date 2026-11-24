# Multi-family hosting design

November 24, 2026. Status: draft, awaiting the owner's approval.

## Intent

The owner wants to run one server for several families they know, and to keep the door open to turning it into a SaaS later. Today the architecture already isolates families (`family_id`, RLS, per-family dedup), but there is no way to create a second family: `pnpm db:seed` runs once per installation and `allowUserToCreateOrganization` is `false`. The docs also call the app "self-hosted", which reads as "install it on your own box" rather than "one installation serves several families, hosted anywhere".

## Scope

**Goals:**
- An operator command that creates a family and invites its owner by email.
- An operator command that sends a family's owner invitation again (the new family has no members to do it).
- The storage-usage rule per family, written into the architecture now.
- Reworded "self-hosted" in `README.md`, `CLAUDE.md` and the architecture docs.

**Non-goals:** self-service family creation, quotas, billing, a web operator panel, a platform-admin role, queue fairness between families, production deployment.

**Anti-goals:** the operator knowing or setting anyone's password; an email getting marked verified without the invitation link; any shortcut around the invite-only sign-up; logic that only the CLI can call (a future web panel or SaaS sign-up must reuse it).

## Approaches

| | Approach | Trade-off |
| --- | --- | --- |
| **A (chosen by the owner)** | `pnpm family:create` creates the family and mails an owner invitation; the owner signs up through the existing invitation flow | No new UI, no passwords handled by the operator; the family has no members until the invitation is accepted, so a resend command is needed |
| B | Extend `db:seed` to create the owner with a password the operator picks | Fastest, but the operator sets a password and the email counts as verified without proof |
| C | Web operator panel with a platform-operator role | Useful for SaaS, but a new role outside family roles (the Better Auth admin plugin is ruled out) and too much for a few families |

## Decided by the owner

- Only the owner of the server creates families, through an operator tool (approach A).
- Storage accounting per family and the doc rewording are part of this change.

## Design (builder's calls, open to correction)

- **Service:** `createFamily(db, mailer, { name, ownerEmail, locale, inviterEmail })` in `apps/api/src/modules/identity` (it owns `organization`, `member` and `invitation`), exported through its `index.ts`. In one transaction it inserts the `organization` (slug made the same way `seedOwner` makes it; extract that helper) and a pending `invitation` with role `owner`, the given `locale`, `ui_size` `compact` and the usual 7-day expiry; after commit it sends the invitation with the existing `Mailer.invitation`. It returns the family id, slug and invitation id.
- **Inviter:** `invitation.inviter_id` is required, so the inviter is the operator's own account, given by `OPERATOR_EMAIL` (or `--inviter`). It must exist with a verified email; otherwise the command fails with a clear error. The invitation email and `/invite/:token` show the operator's name as the inviter.
- **Resend:** `resendOwnerInvitation(db, mailer, { familySlug, ownerEmail?, inviterEmail })` cancels the family's pending owner invitations and creates a new one (same email unless another is given). It refuses when the family already has an owner, so it can't be used to take over a live family.
- **Commands** (built like `seed.ts`, with `SmtpMailer` so the email really goes out):
  - `pnpm family:create --name <name> --owner-email <email> [--locale en|ru]`
  - `pnpm family:invite-owner --family <slug> [--owner-email <email>]`
  - `pnpm family:list`: slug, name, owners, member count, pending owner invitation, and storage usage once the `blob` table exists (until then the column is left out).
- **Accepting:** unchanged. A new person signs up from the link (passkey or password, email verified by the link); someone who already has an account signs in and accepts. The usual rules apply: 2FA is mandatory for an owner who signs in with a password.
- **Audit:** no `audit_event` yet: the table doesn't exist (it arrives with the archive tables). Noted as a follow-up: family creation and owner invitations are operator actions to record once it exists.
- **`db:seed` stays** as the first-installation command (it creates the operator's own family with a password); the docs say so and point to `family:create` for every other family.

## Storage accounting (rule now, code with the upload step)

There is no `blob` table yet, so this change writes the rule into `backend.md` and the upload step implements it:

- A family's usage is the sum of `blob.size` plus `blob_derivative.size` over its rows, counting each stored object once. That matches what the bucket actually holds: deduplicated bytes, items in the trash until they are purged, and regenerable derivatives shown as a separate figure.
- `blob_derivative` gains a `size` column; both tables are indexed on `family_id`.
- For a few families a `SUM` query is enough. Quotas (later, for SaaS) would add a per-family counter kept in the same transaction as blob inserts and deletes; nothing in this change blocks that.

## Doc changes

- `README.md`: the first line becomes "A family archive you run yourself: one installation serves several families, on your own server or in the cloud" (or close to it); the "Deployment" row stops naming Docker Compose and Caddy as the plan and says the deployment stack is undecided.
- `CLAUDE.md`: the project line gets the same wording; the commands list gains the `family:*` commands; "Whether there will be a self-hosted deployment stack is undecided" becomes "The production deployment stack is undecided".
- `authentication.md`: "How a new member joins" step 1 describes `db:seed` for the first family and `family:create` for the rest; a short "Operator" section says who the operator is, what they can do, and that they have server-side access to all families' data (SSE, not E2E).
- `backend.md`: the storage-accounting rule in sections 5 and 7; the CVE-2026-45364 row in `authentication.md` says "the reverse proxy" instead of "Caddy".

## Tests

- Integration (Postgres and Mailpit up): `createFamily` creates the family and a pending owner invitation, and the email reaches Mailpit in the requested language; the invitee signs up from it and becomes the owner; an existing user accepts it and becomes the owner; an unknown or unverified `OPERATOR_EMAIL` fails without creating anything; `resendOwnerInvitation` replaces the pending invitation and refuses once the family has an owner.
- The existing mandatory auth tests stay as they are (sign-up without an invitation is still rejected).

## Left to the builder

Argument parsing for the commands, exact error messages, the `family:list` output format, and the final wording of the doc sentences within the tone of the existing docs.
