<p align="center"><img src="docs/design/logo/swarm-keeper-mark.svg" width="96" alt="Swarm Keeper"></p>

# Swarm Keeper

A self-hosted family archive: photos, videos and documents in one place, with access for the whole family.

- **Families and roles.** Invite-only sign-up and passkeys. Roles are owner, admin, member and viewer; one person can belong to several families.
- **Photo timeline.** A justified timeline with albums, people and personal favorites.
- **Documents.** Document scans with OCR search and expiry tracking.
- **Uploads.** Uploads resume after interruptions and skip duplicates; the native app adds auto-upload from phones.
- **Two languages.** English and Russian from day one, with compact and large interface sizes.
- **Your data stays yours.** Originals are never modified, and the export format is open: originals plus JSON/XMP sidecars.

> **Status:** design phase. The architecture and the design system are specified in [`docs/`](docs/); implementation hasn't started yet.

## Documentation

- [Backend architecture](docs/architecture/backend.md): modular monolith, storage, data model, API contract.
- [Authentication](docs/architecture/authentication.md): Better Auth, invitations, roles, security.
- [Frontend architecture](docs/architecture/frontend.md): Angular 22, state, gallery, uploads.
- [Languages](docs/architecture/i18n.md): English and Russian across every layer.
- [Design system](docs/design/README.md): tokens, glossary, components, logo.

## Planned stack

| Layer | Choice |
| --- | --- |
| API and workers | NestJS (Express) + TypeScript, pg-boss |
| Data | PostgreSQL (RLS, full-text search, pg_trgm), S3-compatible object storage |
| Media processing | sharp, ffmpeg, exiftool, ocrmypdf |
| Authentication | Better Auth (passkeys, 2FA, organizations) |
| Web | Angular 22, Angular Material (M3), NgRx SignalStore, Transloco |
| Deployment | Docker Compose, Caddy |
| Monorepo | pnpm workspaces |

## License

To be decided.
