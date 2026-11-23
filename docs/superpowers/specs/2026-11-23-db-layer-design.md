# Database layer design

November 23, 2026. Status: approved. Step 2 of `docs/superpowers/roadmaps/2026-11-23-better-auth-roadmap.md`.

## Intent

The API and the worker need a typed connection to PostgreSQL and a migration history that grows step by step. Every later step (Better Auth tables, archive tables, RLS) lands as a migration on top of this.

## Scope

**Goals:** Kysely connection for the API and the worker, migrations runnable from `pnpm`, generated table types, a test database recreated before API tests, the first real migration (`pg_trgm`).

**Non-goals:** Better Auth tables (moved to step 3: the CLI generates them from the full `auth.ts` config, which only exists in step 3), archive tables, RLS policies and `SET LOCAL`, the per-request transaction. Those land with the first archive tables.

## Approaches

| | Approach | Trade-off |
| --- | --- | --- |
| **A (chosen)** | `kysely-ctl` for migrations, `kysely-codegen` for types | Two dev dependencies and a config file; types are generated from the real schema, so drift shows up in the diff |
| B | Own scripts on Kysely's `Migrator`, hand-written types | No extra dependencies; `db:new` written by hand, and types silently drift from migrations as tables grow |

## Design

- **Dependencies** (exact, through the catalog): `kysely` 0.29.9, `pg` 8.23.1; dev: `kysely-ctl` 0.22.0, `kysely-codegen` 0.20.0, `@types/pg` 8.23.1.
- **Connection:** `apps/api/src/database/`. A global `DatabaseModule` provides `Kysely<DB>` over a `pg` pool built from `DATABASE_URL`, and destroys the pool on application shutdown. The worker gets it through `@swarm-keeper/api`.
- **Naming:** snake_case in the database (as in `backend.md`: `family_id`, `updated_at`), camelCase in TypeScript through Kysely's `CamelCasePlugin`. Codegen runs with `--camel-case` so the types match the code. How Better Auth's tables fit this is settled in step 3.
- **Migrations:** `apps/api/migrations/`, TypeScript files. The first one enables `pg_trgm`. New tables default their IDs to Postgres 18's native `uuidv7()`.
- **Root scripts:** `db:migrate` (latest), `db:migrate:down` (one step back), `db:new <name>`, `db:types` (regenerates `apps/api/src/database/schema.ts` from the dev database; the file is committed and regenerated after every migration).
- **Tests:** before API tests, a setup drops and recreates `swarm_keeper_test` (the database name swapped into `DATABASE_URL`) and migrates it to latest with Kysely's `Migrator` from the same folder. Tests check that migrations go up and down (`pg_trgm` present after latest, absent after rolling back) and that `DatabaseModule` connects and runs `select 1`.
- **Docs:** `backend.md` says Kysely and snake_case; `CLAUDE.md` lists the `db:*` scripts; the roadmap moves Better Auth tables to step 3.

## Builder's calls

- The `kysely-ctl` config file name and location, and how it reads `DATABASE_URL` (dev default when unset, like `infra/dev/env.sh`).
- Whether codegen needs explicit excludes for the migration bookkeeping tables.
