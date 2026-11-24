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

## Layout

The monorepo uses pnpm workspaces (Node 26, pnpm 12). Module boundaries are enforced by Sheriff (`sheriff.config.ts`, checked by ESLint).

```
apps/api       @swarm-keeper/api      NestJS (Express adapter), routes under /api/v1
apps/worker    @swarm-keeper/worker   same codebase, worker mode: imports API modules from @swarm-keeper/api
apps/web       @swarm-keeper/web      Angular 22, zoneless, no SSR
libs/shared/permissions   @swarm-keeper/permissions    Better Auth access control: roles + statements, used by api and web
libs/shared/design-tokens @swarm-keeper/design-tokens  generated from docs/design/tokens.json (Style Dictionary)
libs/web/api-client       @swarm-keeper/api-client     generated from the OpenAPI spec — never edit by hand
libs/web/core             @swarm-keeper/web-core
libs/web/ui               @swarm-keeper/web-ui
libs/web/features/<name>  @swarm-keeper/feature-<name>  layers in src/{data-access,feature,ui}
```

- Libraries are source-only: `exports` points at `src/index.ts`, and the apps compile them. Aliases live in `tsconfig.base.json`.
- `apps/api` and `apps/worker` declare their own `paths` in `tsconfig.json`, listing only the packages the backend may use. Add a new shared library there too.
- `libs/shared/*` are compiled into the API and worker under `nodenext`, so their relative imports use `.js` suffixes (their tsconfig enforces it).
- Every app keeps an `index.ts` in `src/`: without it Sheriff does not treat the app as a module and skips its rules. Boundary regression tests live in `tools/boundaries`.
- API modules live in `apps/api/src/modules/<name>` and are reachable from other modules only through their `index.ts`.
- `apps/api/src/database` is the Kysely connection (`DatabaseModule`, token `DATABASE`); any API module may import it through its `index.ts`. A runtime dependency of API code must also be listed in `apps/worker/package.json`, because the worker compiles API sources.
- Dependency versions are pinned exactly; shared ones go in the `catalog:` of `pnpm-workspace.yaml`.

## Commands

```
pnpm install                                  install everything
pnpm build                                    build all apps
pnpm typecheck                                type-check every package
pnpm test                                     unit tests (Vitest) in every package
pnpm e2e                                      Playwright end to end (needs pnpm infra:up; first run: pnpm --filter @swarm-keeper/web-e2e exec playwright install chromium)
pnpm lint                                     ESLint + Sheriff boundary rules + pnpm i18n:check (en/ru keys)
pnpm format                                   Prettier
pnpm --filter @swarm-keeper/<pkg> <script>    run one package's script, e.g. start or test
pnpm exec sheriff list <api|worker|web>       show modules and their tags
pnpm tokens:build                             regenerate libs/shared/design-tokens/src/tokens.css after editing docs/design/tokens.json
```

## Local infrastructure

Development only: `compose.yaml` runs the infrastructure, and the apps run on the host via `pnpm`. Whether there will be a self-hosted deployment stack is undecided.

| Service | Image | Port (127.0.0.1) |
| --- | --- | --- |
| PostgreSQL, database `swarm_keeper` | `postgres:18.7-alpine` | 5432 |
| Garage (S3), bucket `swarm-keeper`, region `garage` | `dxflrs/garage:v2.5.0` | 3900 |
| Mailpit (SMTP + web UI) | `axllent/mailpit:v1.34.0` | 1025, 8025 |

```
pnpm infra:up      start and bootstrap (idempotent: creates the Garage layout, dev key and bucket)
pnpm infra:down    stop, keep data
pnpm infra:reset   stop and delete all data
pnpm infra:logs    follow logs
pnpm infra:check   smoke test; CHECK_PROXY=1 also checks the web dev proxy
```

```
pnpm db:migrate        apply pending migrations (apps/api/migrations) to DATABASE_URL, the dev database by default
pnpm db:migrate:down   undo the last migration
pnpm db:new <name>     create a migration file
pnpm db:types          regenerate apps/api/src/database/schema.ts from the dev database
pnpm db:seed           create the first owner and family (SEED_OWNER_EMAIL, SEED_OWNER_PASSWORD, SEED_FAMILY_NAME)
```

- Run `pnpm db:types` after every migration and commit `schema.ts`; never edit it by hand.
- Better Auth runs inside the API at `/api/auth/*`; every other route needs a session unless marked `@AllowAnonymous()`. Its settings (`BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `PASSKEY_RP_ID`) have dev defaults only when `NODE_ENV` is `development` or `test` (Vitest sets `test`); run the API and `pnpm db:seed` locally with `NODE_ENV=development`. The API listens on `127.0.0.1` unless `HOST` is set.
- API tests drop and recreate `swarm_keeper_test` and migrate it, and the email tests read Mailpit, so the infrastructure must be up (`pnpm infra:up`).
- Auth emails go over SMTP (`SMTP_URL`, `MAIL_FROM`); in development they land in Mailpit at http://127.0.0.1:8025.
- Every setting has a dev default (`compose.yaml`, `infra/dev/env.sh`). Copy `.env.example` to `.env` only to override one.
- `pnpm --filter @swarm-keeper/web start` serves the web app on 4200 and proxies `/api` to the API on 3000, so both share one origin.

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
- Playwright for end-to-end tests (`apps/web-e2e`, `pnpm e2e`): it starts the real API on 3100 against a fresh `swarm_keeper_e2e` database and the web dev server on 4300, with Postgres and Mailpit from `pnpm infra:up`. Every scenario runs in `chromium-en` and `chromium-ru`; passkeys use Chromium's virtual authenticator. `pnpm test` does not run it.
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
