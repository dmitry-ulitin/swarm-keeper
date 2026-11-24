import { type QueryExecutorProvider, sql } from 'kysely';

/**
 * The group role the API, the worker and the CLI connect through. It is not a superuser and
 * does not bypass RLS, so the family policies apply to it. It owns nothing and has no DDL rights:
 * migrations run as the schema owner and grant it what it needs.
 */
export const APP_ROLE = 'swarm_keeper_app';

/** The dev login in APP_ROLE (`DATABASE_URL` in development). Development and tests only. */
export const DEV_APP_LOGIN = { user: 'swarm_app', password: 'swarm_app' } as const;

/**
 * Creates APP_ROLE, and with `devLogin` the dev login in it, when missing. Roles are
 * cluster-wide and need CREATEROLE, so this runs once per cluster as an admin (`pnpm db:roles`),
 * never from a migration.
 */
export async function ensureAppRoles(
  db: QueryExecutorProvider,
  options: { devLogin: boolean },
): Promise<void> {
  // DO blocks take no parameters; the names and the dev password are constants.
  await sql
    .raw(
      `do $$ begin
        if not exists (select from pg_roles where rolname = '${APP_ROLE}') then
          create role ${APP_ROLE} nologin nosuperuser nobypassrls;
        end if;
      end $$`,
    )
    .execute(db);
  if (options.devLogin) {
    await sql
      .raw(
        `do $$ begin
          if not exists (select from pg_roles where rolname = '${DEV_APP_LOGIN.user}') then
            create role ${DEV_APP_LOGIN.user} login nosuperuser nobypassrls
              password '${DEV_APP_LOGIN.password}' in role ${APP_ROLE};
          end if;
        end $$`,
      )
      .execute(db);
  }
}

/** Fails with a pointer to `pnpm db:roles` when the role does not exist. */
export async function assertAppRoleExists(
  db: QueryExecutorProvider,
  role: string = APP_ROLE,
): Promise<void> {
  const { rows } = await sql`select 1 from pg_roles where rolname = ${role}`.execute(db);
  if (rows.length === 0) {
    throw new Error(`Database role ${role} is missing: run pnpm db:roles first (as an admin)`);
  }
}
