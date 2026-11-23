# CLAUDE.md

Guidance for Claude Code in this repository.

## Project

**Swarm Keeper** is a self-hosted family archive for photos and documents with access for the whole family. Components:

- NestJS API and workers;
- Angular 22 web app;
- a separate native mobile app (its stack is not chosen yet, and it lives outside this repo).

**Status:** design is done, there is no code yet. The documents in `docs/` are the specification. Read the relevant one before starting a task.

| Topic | Document |
| --- | --- |
| Backend, data model, API contract | `docs/architecture/backend.md` |
| Authentication (Better Auth), roles | `docs/architecture/authentication.md` |
| Web app (Angular) | `docs/architecture/frontend.md` |
| Languages (en + ru) across layers | `docs/architecture/i18n.md` |
| Design system, glossary, components | `docs/design/README.md`, `docs/design/tokens.json`, `docs/design/components/` |

## Language

- Everything in the repository is in English: code, comments, docs, commit messages, PRs and issues.
- Russian appears only in `ru` translation files and in the bilingual glossary.
- The owner may write to you in Russian. Reply in the language of the message.

## Planned layout

The monorepo uses pnpm workspaces. Module boundaries are enforced by Sheriff.

```
apps/api       NestJS (Express adapter)
apps/worker    same codebase, worker mode (pg-boss jobs)
apps/web       Angular 22
libs/shared/permissions   Better Auth access control: roles + statements, used by api and web
libs/shared/design-tokens generated from docs/design/tokens.json (Style Dictionary)
libs/web/api-client       generated from the OpenAPI spec — never edit by hand
libs/web/core, libs/web/ui, libs/web/features/*
```

Add build, test and lint commands here once the workspace is scaffolded.

## Invariants (do not break without updating the docs)

**Tenancy and access**
- Every archive table has `family_id` (= Better Auth `organization.id`) and a PostgreSQL RLS policy.
- The API sets `SET LOCAL app.family_id` and `app.user_id` per request transaction.
- Authorization lives in the service layer and uses `libs/shared/permissions`. The UI hides actions using the permission list from `GET /me`, but the server always checks again.
- Private assets (`visibility = private`) are visible only to their owner, whatever the role.
- IDs are UUIDv7.

**Storage**
- Bytes are stored only in S3-compatible storage, behind the `BlobStorage` interface.
- A `blob` holds one file's bytes per family (unique on `family_id, sha256`); an `asset` is one owner's record pointing to it.
- Originals are immutable; derivatives can always be regenerated.
- Clients upload directly via presigned URLs and multipart.
- The "already exists" answer may consider only the user's own assets and the family's shared assets. It must never reveal that someone else's private file has the same bytes.
- Previews are served through stable URLs (`/assets/:id/thumb?size=256|512`) that answer with a 302 to a presigned URL.

**API**
- All routes are under `/api/v1`, and changes within a version are additive only. The OpenAPI spec is checked with `oasdiff` in CI.
- Errors are codes with params (`{ code, params }`), never human-readable text.
- Synced tables have `updated_at`. Permanent deletes write a `tombstone` row.
- State-changing actions (upload, delete, restore, metadata edits, invitations, role changes) write an `audit_event` in the same transaction.

**Auth (Better Auth)**
- Sign-up is invite-only, enforced by the `user.create.before` hook.
- The invitation link verifies the email, and only when the sign-up email matches the invitation email.
- 2FA is mandatory for owners and admins who sign in with a password.
- Only the organization, passkey, twoFactor and bearer plugins are enabled. Google/Apple sign-in stays off, and so does `cookieCache`.
- Pin `better-auth` versions exactly. Check option names against the docs of the installed version.

**Retention**
- The trash keeps items for 30 days.
- When a member leaves, their shared files stay with the family. Their private files are deleted after 30 days.

**Frontend (Angular 22)**
- Use standalone components, zoneless change detection and OnPush everywhere.
- State lives in signals: `httpResource` for simple reads, NgRx SignalStore per feature (provided on the lazy route, not in root). Use RxJS only for real streams, such as the upload queue.
- Forms use Signal Forms. There is no SSR. The web app is a PWA without offline mode: the service worker caches the app shell only.
- Templates contain no literal text. Translations use Transloco with per-feature `i18n/<feature>/en.json` and `ru.json` and ICU plurals. Dates, numbers and sizes go through `Intl`.
- CI fails on missing keys.
- Layouts have no fixed widths, because Russian strings run 20–30% longer.
- Styling uses tokens only (no raw colors or px). Material is themed through `--mat-sys-*` overrides.
- Compact mode is the default. Large mode is `html[data-size="large"]`.
- Feature folders have three layers: `data-access`, `feature`, `ui`. Features never import each other.

## Tests

- Vitest for unit tests: stores, the permission directive, the gallery layout, the upload queue.
- Playwright for end-to-end tests against the real API in Docker Compose. Run key screens in both languages.
- Never skip these auth integration tests:
  - sign-up without an invitation is rejected;
  - an unverified email can't accept an invitation;
  - a viewer can't upload;
  - another family's data is inaccessible.

## Working rules

- If a change contradicts a document in `docs/`, update the document in the same change, or ask first.
- Keep `docs/design/tokens.json` as the single source of design values.
- Commits follow Conventional Commits (`feat(api): …`, `fix(web): …`, `docs: …`).
- Never commit secrets. Configuration goes through environment variables, with an `.env.example` committed.

## Open questions

- Which email service sends the emails.
- Whether SSO into other self-hosted services will be needed.
- The native app's stack.
