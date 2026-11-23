# Workspace scaffold design

November 23, 2026. Status: approved.

## Intent

The project has a finished design and no code. This step creates a working pnpm monorepo skeleton that matches the layout in `CLAUDE.md` and `docs/architecture/frontend.md`, so later tasks (Better Auth, API modules, web features) have a place to land and module boundaries are enforced from day one.

## Scope

**Goals (working minimum):** root workspace config, shared TypeScript config, an empty but buildable NestJS API with a worker entry point, an Angular 22 app (zoneless, no SSR), source-only library packages, Sheriff boundary rules, Vitest, ESLint and Prettier. `pnpm build`, `pnpm typecheck`, `pnpm test` and `pnpm lint` pass.

**Non-goals (next steps):** Docker Compose and Caddy, Better Auth, database access and pg-boss, Transloco, Angular Material, Style Dictionary, OpenAPI client generation, PWA, CI.

## Approaches

| | Approach | Trade-off |
| --- | --- | --- |
| **A (chosen)** | `apps/worker` is a thin entry point that depends on `@swarm-keeper/api` and boots Nest with `createApplicationContext`. Libraries are source-only packages. One Sheriff config. | Matches the docs exactly; module isolation comes from Sheriff rather than package boundaries. |
| B | Backend modules as packages in `libs/api/*`, apps only assemble them. | Harder boundaries, but more packages and the docs would need updating. |
| C | One app with two `main` files; `apps/worker` holds only launch config. | Simplest, but the worker package becomes almost empty. |

A was picked because it keeps the documented layout ("same codebase, worker mode") and Sheriff gives the same module isolation as B.

## Layout

```
apps/api      @swarm-keeper/api     NestJS (Express), prefix /api/v1, GET /api/v1/health
  src/modules/{identity,assets,albums,documents,search,audit,jobs}/
  src/index.ts  exports modules for the worker
apps/worker   @swarm-keeper/worker  createApplicationContext(WorkerModule), graceful shutdown
apps/web      @swarm-keeper/web     Angular 22 (CLI), zoneless, no SSR, SCSS, Vitest
libs/shared/permissions    @swarm-keeper/permissions
libs/shared/design-tokens  @swarm-keeper/design-tokens  (generated from docs/design/tokens.json later)
libs/web/api-client        @swarm-keeper/api-client     (generated later, never edited by hand)
libs/web/core              @swarm-keeper/web-core
libs/web/ui                @swarm-keeper/web-ui
libs/web/features/<name>   @swarm-keeper/feature-<name>
  gallery, documents, upload, family, people, search, trash, settings
  src/{data-access,feature,ui}/
```

Each library has a `package.json` whose `exports` points at `./src/index.ts` and no build of its own; the apps compile them. Path aliases live in `tsconfig.base.json`. Dependency versions are the latest stable ones, pinned exactly through the pnpm catalog.

## Boundary rules (Sheriff)

- `scope:api` (api, worker) may depend on `scope:shared`; `scope:web` (web app and `libs/web/**`) may depend on `scope:shared`; api and web never depend on each other.
- API modules are tagged `api:module:<name>`; another module is reachable only through its `index.ts`.
- Features may depend on `web-core`, `web-ui`, `api-client` and shared libraries, never on another feature.
- Inside a feature: `feature` → `data-access`, `ui`; `data-access` → `api-client`, `web-core`; `ui` → `web-ui`.

## Builder's calls

- Node 26, pnpm 12.14.0 pinned via `packageManager`.
- API and worker compile with `tsc`, without the Nest CLI.
- API modules start as empty Nest module classes so Sheriff has something to check.
