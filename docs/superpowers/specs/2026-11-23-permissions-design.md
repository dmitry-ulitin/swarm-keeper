# Permissions library design

November 23, 2026. Status: approved. Step 1 of `docs/superpowers/roadmaps/2026-11-23-better-auth-roadmap.md`.

## Intent

The role matrix in `docs/architecture/authentication.md` ("Roles and permissions") is the single source of permissions for the API (server-side checks) and the web app (hiding actions). Today it exists only as a table. This step turns it into code in `libs/shared/permissions`, pinned by tests.

## Scope

**Goals:** `statement`, `ac`, `roles` (owner, admin, member, viewer) and the `FamilyRole` type, built with Better Auth's access control; unit tests that pin every matrix row for every role.

**Non-goals:** wiring into Better Auth or NestJS (step 3), `GET /me`, the web directive, ownership-of-record checks (`owner_id`), private-asset visibility (service layer and RLS).

## Approaches

| | Approach | Trade-off |
| --- | --- | --- |
| **A (chosen)** | Better Auth's `createAccessControl` with the organization plugin's default statements, as in the spec skeleton. | One mechanism for Better Auth's own checks (members, invitations) and ours; the organization plugin consumes `ac` and `roles` directly. |
| B | A hand-written role → permissions map, adapted to Better Auth later. | No dependency in the shared library, but two sources of truth once the organization plugin needs `ac`. |

There is one sensible way: the spec already fixes A, and B would duplicate the matrix.

## Design

- **Package:** `@swarm-keeper/permissions`. Imports only `better-auth/plugins/access` and `better-auth/plugins/organization/access`, so the web bundle does not pull in the rest of Better Auth. `better-auth@1.7.27`, pinned exactly through the catalog.
- **Statements:** organization plugin `defaultStatements` plus:
  - `asset: read, create, update, delete, manage`
  - `album: read, create, update, delete, manage`
  - `archive: export, purge-trash`
- **Roles:**

| Role | Better Auth base | asset / album | archive |
| --- | --- | --- | --- |
| owner | `ownerAc` | all actions | `export`, `purge-trash` |
| admin | `adminAc` | all actions | `export`, `purge-trash` |
| member | `memberAc` | `read`, `create`, `update`, `delete` | — |
| viewer | none | `read` | — |

- **Exports:** `statement`, `ac`, `roles`, `type FamilyRole = keyof typeof roles`.
- **Semantics carried as comments:** for members, `update` / `delete` apply to their own records (the service checks `owner_id`); `manage` is the right to change other people's items.

## Matrix → statements (what the tests pin)

| Matrix row | Statement | owner | admin | member | viewer |
| --- | --- | --- | --- | --- | --- |
| View shared photos and documents | `asset:read`, `album:read` | yes | yes | yes | yes |
| Upload, create albums | `asset:create`, `album:create` | yes | yes | yes | no |
| Edit and delete own items | `asset:update`, `asset:delete`, `album:update`, `album:delete` | yes | yes | yes | no |
| Edit and delete others' shared items | `asset:manage`, `album:manage` | yes | yes | no | no |
| Invite and remove members, change roles | `member:create/update/delete`, `invitation:create/cancel` | yes | yes | no | no |
| Empty the trash, export the archive | `archive:purge-trash`, `archive:export` | yes | yes | no | no |
| Delete the family | `organization:delete` | yes | no | no | no |

## Calls made here

- **Favorites** have no statement: they are personal, and every role may mark them, so family membership is enough.
- **Ownership transfer** is a service rule (only an owner grants the owner role), handled in step 3, not a statement.
- The `team` and `ac` defaults stay as inherited from the Better Auth base roles; teams and dynamic access control are not used.
