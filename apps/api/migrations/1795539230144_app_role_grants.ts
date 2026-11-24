import { type Kysely, sql } from 'kysely';

// Migrations take Kysely<any>: they are frozen in time and must not follow schema.ts.

/**
 * Grants the application role (swarm_keeper_app, created by `pnpm db:roles`) data access to the
 * tables that exist now. Later tables grant for themselves (familyRls does it for archive tables):
 * no default privileges, which only cover tables created later by the same role.
 */
export async function up(db: Kysely<any>): Promise<void> {
  // Same check as assertAppRoleExists (src/database/app-role.ts), inlined: migrations load as
  // plain .ts through Node and import nothing from src.
  const { rows } = await sql`select 1 from pg_roles where rolname = 'swarm_keeper_app'`.execute(db);
  if (rows.length === 0) {
    throw new Error(
      'Database role swarm_keeper_app is missing: run pnpm db:roles first (as an admin)',
    );
  }
  await sql`grant usage on schema public to swarm_keeper_app`.execute(db);
  await sql`grant select, insert, update, delete on all tables in schema public to swarm_keeper_app`.execute(
    db,
  );
  await sql`revoke all on kysely_migration, kysely_migration_lock from swarm_keeper_app`.execute(
    db,
  );
  await sql`grant usage, select on all sequences in schema public to swarm_keeper_app`.execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
  await sql`revoke all on all sequences in schema public from swarm_keeper_app`.execute(db);
  await sql`revoke all on all tables in schema public from swarm_keeper_app`.execute(db);
  await sql`revoke usage on schema public from swarm_keeper_app`.execute(db);
}
