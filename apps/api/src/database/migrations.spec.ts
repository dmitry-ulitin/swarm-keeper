import { sql } from 'kysely';
import { afterAll, describe, expect, it } from 'vitest';
import { createDatabase } from './create-database.js';
import { databaseUrl } from './database-url.js';
import { createMigrator } from './migrator.js';

// Runs against swarm_keeper_test, migrated to latest by test/global-setup.ts.
describe('migrations', () => {
  const db = createDatabase(databaseUrl());
  const migrator = createMigrator(db);

  afterAll(() => db.destroy());

  async function hasTrgm(): Promise<boolean> {
    const { rows } = await sql`select extname from pg_extension where extname = 'pg_trgm'`.execute(
      db,
    );
    return rows.length === 1;
  }

  it('runs against the test database', async () => {
    const { rows } = await sql<{ name: string }>`select current_database() as name`.execute(db);
    expect(rows[0]?.name).toBe('swarm_keeper_test');
  });

  it('enables pg_trgm at latest', async () => {
    expect(await hasTrgm()).toBe(true);
  });

  it('rolls the last migration back and forward again', async () => {
    const down = await migrator.migrateDown();
    expect(down.error).toBeUndefined();
    expect(await hasTrgm()).toBe(false);

    const latest = await migrator.migrateToLatest();
    expect(latest.error).toBeUndefined();
    expect(await hasTrgm()).toBe(true);
  });
});
