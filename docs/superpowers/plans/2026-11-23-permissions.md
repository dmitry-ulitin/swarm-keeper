# Permissions Library Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `@swarm-keeper/permissions` exports Better Auth access control (`statement`, `ac`, `roles`, `FamilyRole`, `isFamilyRole`), and the role matrix is pinned by tests.

**Architecture:** One source file builds the statements on top of the organization plugin's `defaultStatements` and creates four roles from `ownerAc` / `adminAc` / `memberAc` statements plus our resources. A table-driven Vitest spec mirrors the matrix in the design doc.

**Tech Stack:** `better-auth@1.7.27` (`better-auth/plugins/access`, `better-auth/plugins/organization/access`), TypeScript 6 (`nodenext`), Vitest 5.

**Spec:** `docs/superpowers/specs/2026-11-23-permissions-design.md`

## Global Constraints

- Imports only from `better-auth/plugins/access` and `better-auth/plugins/organization/access`; never from `better-auth` root.
- `better-auth` pinned exactly at `1.7.27` via the `catalog:` in `pnpm-workspace.yaml`.
- `libs/shared/*` use `nodenext`: relative imports carry `.js` suffixes.
- Statement names and actions exactly as in the spec: `asset` / `album`: `read, create, update, delete, manage`; `archive`: `export, purge-trash`.
- Commits follow Conventional Commits.

## Review Focus

1. A role string read from the database that is not one of the four (e.g. a stale `guest`) must be detectable without crashing — `isFamilyRole` test in Task 1.
2. Importing the library in the web app must not pull the whole of Better Auth into the bundle — Task 1 Step 6 measures it.
3. An admin must not be able to delete the family — matrix row "Delete the family".
4. A viewer must get none of Better Auth's member/invitation rights by inheritance — matrix row "Invite and remove members".
5. Asking about an action that does not exist on a resource must be a type error, not a silent `false` — Task 1 Step 1 includes a `// @ts-expect-error` line, checked by `pnpm typecheck`.

---

### Task 1: Statements, roles and matrix tests

**Files:**
- Create: `libs/shared/permissions/src/permissions.ts`, `libs/shared/permissions/src/permissions.spec.ts`, `libs/shared/permissions/vitest.config.ts`
- Modify: `libs/shared/permissions/src/index.ts`, `libs/shared/permissions/package.json` (dependency `better-auth: catalog:`, devDependency `vitest: catalog:`, script `test` = `vitest run`), `libs/shared/permissions/tsconfig.json` (include `vitest.config.ts`), `pnpm-workspace.yaml` (catalog `better-auth: 1.7.27`), `libs/shared/permissions/README.md` (one line on what the roles mean and where the matrix lives)

**Interfaces:**
- Produces (from `@swarm-keeper/permissions`):
  - `statement` — `const` object: `defaultStatements` + `asset`, `album`, `archive`.
  - `ac = createAccessControl(statement)`.
  - `roles: { owner, admin, member, viewer }` — each a Better Auth `Role` with `authorize(request)`.
  - `type FamilyRole = keyof typeof roles`.
  - `FAMILY_ROLES: readonly FamilyRole[]` = `['owner', 'admin', 'member', 'viewer']`.
  - `isFamilyRole(value: unknown): value is FamilyRole`.

- [ ] **Step 1: Write the failing test** `permissions.spec.ts`:
  - a table `matrix: [row: string, request: Record<resource, action[]>, allowed: Record<FamilyRole, boolean>][]` with exactly the seven rows of the spec's "Matrix → statements" table. Each row with several actions is checked per action (each `{ [resource]: [action] }` separately), and the expectation applies to every one;
  - `it.each` over rows × roles: `expect(roles[role].authorize({ [resource]: [action] }).success).toBe(allowed[role])`;
  - `isFamilyRole`: `true` for the four names, `false` for `'guest'`, `''`, `'Owner'`, `undefined`, `42`;
  - `FAMILY_ROLES` equals `['owner', 'admin', 'member', 'viewer']` and `Object.keys(roles).sort()` equals it sorted;
  - one compile-time check: `// @ts-expect-error unknown action` before `roles.member.authorize({ asset: ['fly'] })`.
- [ ] **Step 2:** `pnpm install && pnpm --filter @swarm-keeper/permissions test`. Expected: FAIL (module `./permissions.js` not found).
- [ ] **Step 3:** Implement `permissions.ts` per the spec's roles table: `owner` = `ownerAc.statements` + all asset/album actions + both archive actions; `admin` = `adminAc.statements` + same; `member` = `memberAc.statements` + asset/album `read, create, update, delete`; `viewer` = asset/album `read` only. Comments carry the `update`/`delete` = own records and `manage` = others' items semantics. Re-export from `index.ts`.
- [ ] **Step 4:** `pnpm --filter @swarm-keeper/permissions test && pnpm --filter @swarm-keeper/permissions typecheck`. Expected: all pass; typecheck exit 0 (the `@ts-expect-error` line is satisfied).
- [ ] **Step 5:** `pnpm lint && pnpm test && pnpm build`. Expected: exit 0.
- [ ] **Step 6: Bundle check.** Temporarily import `roles` in `apps/web/src/app/app.config.ts` and reference it (`void roles`), run `pnpm --filter @swarm-keeper/web build`, note the initial bundle total against the `190.49 kB` baseline, then revert. Expected: growth well under 50 kB raw; if larger, record what was pulled in and rule on it.
- [ ] **Step 7: Commit** `feat(permissions): add family roles and access control`.
