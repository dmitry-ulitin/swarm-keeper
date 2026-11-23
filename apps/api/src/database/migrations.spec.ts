import { sql } from 'kysely';
import { NO_MIGRATIONS } from 'kysely/migration';
import { afterAll, describe, expect, it } from 'vitest';
import { createDatabase } from './create-database.js';
import { databaseUrl } from './database-url.js';
import { createMigrator } from './migrator.js';

// Runs against swarm_keeper_test, migrated to latest by test/global-setup.ts.
describe('migrations', () => {
  const db = createDatabase(databaseUrl());
  const migrator = createMigrator(db);

  afterAll(() => db.destroy());

  async function schemaState() {
    const extensions = await sql<{ extname: string }>`
      select extname from pg_extension where extname = 'pg_trgm'`.execute(db);
    const tables = await sql<{ name: string }>`
      select table_name as name from information_schema.tables
      where table_schema = 'public' and table_name not like 'kysely_%'
      order by table_name`.execute(db);
    return { trgm: extensions.rows.length === 1, tables: tables.rows.map((r) => r.name) };
  }

  it('runs against the test database', async () => {
    const { rows } = await sql<{ name: string }>`select current_database() as name`.execute(db);
    expect(rows[0]?.name).toBe('swarm_keeper_test');
  });

  it('enables pg_trgm and creates the Better Auth tables at latest', async () => {
    const state = await schemaState();
    expect(state.trgm).toBe(true);
    expect(state.tables).toEqual(
      expect.arrayContaining(['user', 'session', 'organization', 'member']),
    );
  });

  // Every down undoes its up: all the way down leaves an empty schema, and back up restores it.
  it('rolls every migration back and forward again', async () => {
    const before = await schemaState();

    const down = await migrator.migrateTo(NO_MIGRATIONS);
    expect(down.error).toBeUndefined();
    expect(await schemaState()).toEqual({ trgm: false, tables: [] });

    const latest = await migrator.migrateToLatest();
    expect(latest.error).toBeUndefined();
    expect(await schemaState()).toEqual(before);
  });
});
