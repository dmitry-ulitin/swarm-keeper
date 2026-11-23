import { sql } from 'kysely';
import { afterAll, describe, expect, it } from 'vitest';
import { createDatabase } from './create-database.js';
import { databaseUrl } from './database-url.js';

describe('createDatabase', () => {
  const db = createDatabase(databaseUrl());
  const admin = createDatabase(databaseUrl());

  afterAll(async () => {
    await db.destroy();
    await admin.destroy();
  });

  it('survives Postgres dropping an idle pooled connection', async () => {
    const { rows } = await sql<{ pid: number }>`select pg_backend_pid() as pid`.execute(db);
    const pid = rows[0]?.pid;

    // The connection is now idle in the pool; kill it from the server side.
    await sql`select pg_terminate_backend(${pid})`.execute(admin);
    await new Promise((resolve) => setTimeout(resolve, 200));

    const next = await sql<{ one: number }>`select 1 as one`.execute(db);
    expect(next.rows).toEqual([{ one: 1 }]);
  });
});
