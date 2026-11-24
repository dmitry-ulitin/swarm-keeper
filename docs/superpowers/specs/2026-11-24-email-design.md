# Email (step 4) design

November 24, 2026. Status: approved. Step 4 of `docs/superpowers/roadmaps/2026-11-23-better-auth-roadmap.md`; builds on 3a (`2026-11-23-auth-core-design.md`), which put the `Mailer` interface and a logging implementation in place.

## Intent

Auth emails people can read in their own language, and a dev mailbox to see them in. Today `LoggingMailer` only writes links to the log, and `verifyEmail` / `resetPassword` don't receive a language, although `i18n.md` requires `user.locale`.

## Scope

**Goals:** invitation, email verification and password reset, each in `en` and `ru`, as HTML plus `text/plain`; SMTP transport; Mailpit in `compose.yaml`.

**Non-goals:** choosing the production email service (still open in `CLAUDE.md`; SMTP keeps the choice free); branded or MJML layouts; other notification emails; the web screens behind the links (step 6).

**Anti-goals:** template text that bypasses the translation files; user-typed data (family and inviter names) inserted into HTML unescaped.

## Approaches

| | Approach | Trade-off |
| --- | --- | --- |
| **A (chosen by the owner)** | nodemailer over SMTP; templates are TypeScript functions; texts in `en.json` / `ru.json` | One new dependency, typed parameters; escaping is ours to do |
| B | nodemailer plus a template engine (Handlebars, Eta) with HTML in separate files | Engine escaping, but another dependency for three short emails |

Rejected: a provider's HTTP API (the provider is undecided and the archive is self-hosted); MJML (the owner chose a simple look).

## Decided by the owner

- A simple HTML wrapper — the name "Swarm Keeper", a paragraph, a button link, a footer line — plus a `text/plain` part.
- Approach A.

## Design (builder's calls, open to correction)

- **`apps/api/src/modules/mail`** (new module, reached through its `index.ts`): `MailTransport` over nodemailer, configured by `SMTP_URL` and `MAIL_FROM`; the shared HTML layout and `escapeHtml`.
- **Templates stay in `identity`:** `SmtpMailer implements Mailer` renders subject, HTML and text per locale. Texts live in `identity/mail/i18n/{en,ru}.json`, using glossary terms (Family / Семья, Invitation / Приглашение), formal «вы», no exclamation marks. An unknown locale falls back to `en`.
- **`Mailer` interface:** `verifyEmail` and `resetPassword` gain `locale` (from `user.locale`); `invitation` gains `inviterName`, `familyName` and `expiresAt` (formatted with `Intl` in the recipient's language). Field names of Better Auth 1.7.27's `sendInvitationEmail` data are checked against the installed version.
- **Colors:** inline values from `docs/design/tokens.json`; a unit test asserts they match the file (the design-tokens library arrives in step 5).
- **Environment:** `SMTP_URL` (dev default `smtp://127.0.0.1:1025`) and `MAIL_FROM` (dev default `Swarm Keeper <noreply@swarm-keeper.test>`); defaults only when `NODE_ENV` is `development` or `test`, as with `AuthEnv`; both in `.env.example`.
- **Mailpit:** pinned `axllent/mailpit` image, SMTP on `127.0.0.1:1025`, UI and HTTP API on `127.0.0.1:8025`; `pnpm infra:check` checks it; the infrastructure table in `CLAUDE.md` gains a row.
- `pnpm db:seed` keeps `LoggingMailer`.
- nodemailer is pinned exactly and listed in both `apps/api` and `apps/worker`.

## Tests

- Unit: each email in `en` and `ru` (subject, link, glossary terms), names HTML-escaped, `en` fallback, colors match `tokens.json`.
- Integration (Postgres and Mailpit up): an invitation and a password reset through the Better Auth API arrive in Mailpit (read through its HTTP API) with the right recipient, language and link.

## Left to the builder

The exact wording within the glossary and tone rules; the nodemailer and Mailpit versions.
