import { type Kysely, sql } from 'kysely';
import { afterAll, describe, expect, it } from 'vitest';
import { assertAppRoleExists, ensureAppRoles } from './app-role.js';
import { createDatabase } from './create-database.js';
import { databaseOwnerUrl, databaseUrl } from './database-url.js';

describe('application role', () => {
  const appDb = createDatabase(databaseUrl());
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- DDL and catalog queries only
  const ownerDb: Kysely<any> = createDatabase(databaseOwnerUrl());

  afterAll(async () => {
    await appDb.destroy();
    await ownerDb.destroy();
  });

  it('connects the tests as the application login, not the owner', async () => {
    const { rows } = await sql<{ u: string }>`select current_user as u`.execute(appDb);
    expect(rows[0]?.u).toBe('swarm_app');
  });

  it('is idempotent', async () => {
    await ensureAppRoles(ownerDb, { devLogin: true });
    await ensureAppRoles(ownerDb, { devLogin: true });
  });

  it('lets the application role use Better Auth tables but not the migration table', async () => {
    await appDb.selectFrom('user').select('id').limit(1).execute();
    await expect(sql`select * from kysely_migration`.execute(appDb)).rejects.toThrow(
      /permission denied/,
    );
  });

  it('names pnpm db:roles when the role is missing', async () => {
    await expect(assertAppRoleExists(ownerDb, 'no_such_role')).rejects.toThrow(/pnpm db:roles/);
  });
});
