import { type Kysely, sql } from 'kysely';

// Migrations take Kysely<any>: they are frozen in time and must not follow schema.ts.

/**
 * enable_family_rls(table): puts an archive table under the family policy. Every archive table
 * migration calls it right after `create table` (`select enable_family_rls('asset')`):
 * - RLS on and forced, so the owner is filtered too unless it is a superuser;
 * - policy family_isolation: rows whose family_id equals app.family_id, which FamilyDb.run sets
 *   per transaction; unset, the setting is null and matches nothing, so a forgotten run fails closed;
 * - data grants to swarm_keeper_app on that table (there are no default privileges).
 * A SQL function rather than a TS helper: migrations import nothing from src.
 */
export async function up(db: Kysely<any>): Promise<void> {
  await sql`
    create function enable_family_rls(target regclass) returns void
    language plpgsql as $$
    begin
      execute format('alter table %s enable row level security', target);
      execute format('alter table %s force row level security', target);
      execute format(
        'create policy family_isolation on %s '
        'using (family_id = nullif(current_setting(''app.family_id'', true), '''')::uuid) '
        'with check (family_id = nullif(current_setting(''app.family_id'', true), '''')::uuid)',
        target);
      execute format('grant select, insert, update, delete on %s to swarm_keeper_app', target);
    end $$`.execute(db);
  await sql`revoke all on function enable_family_rls(regclass) from public`.execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
  await sql`drop function if exists enable_family_rls(regclass)`.execute(db);
}
