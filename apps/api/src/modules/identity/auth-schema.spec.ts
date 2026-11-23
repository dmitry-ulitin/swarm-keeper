import { getMigrations } from 'better-auth/db/migration';
import { sql } from 'kysely';
import { afterAll, describe, expect, it } from 'vitest';
import { createDatabase, databaseUrl } from '../../database/index.js';
import { authEnv } from './auth-env.js';
import { createAuth } from './create-auth.js';
import { LoggingMailer } from './mailer.js';

// Runs against swarm_keeper_test, migrated to latest by test/global-setup.ts.
describe('Better Auth tables', () => {
  const db = createDatabase(databaseUrl());
  const auth = createAuth(db, authEnv({}), new LoggingMailer());

  afterAll(() => db.destroy());

  it('match what Better Auth expects: nothing to create or add', async () => {
    const { toBeCreated, toBeAdded } = await getMigrations(auth.options);
    expect(toBeCreated.map((t) => t.table)).toEqual([]);
    expect(toBeAdded.map((t) => `${t.table}: ${Object.keys(t.fields).join(', ')}`)).toEqual([]);
  });

  it('have no camelCase table or column names', async () => {
    const { rows } = await sql<{ name: string }>`
      select table_name || '.' || column_name as name from information_schema.columns
      where table_schema = 'public' and table_name not like 'kysely_%'
        and (table_name ~ '[A-Z]' or column_name ~ '[A-Z]')`.execute(db);
    expect(rows).toEqual([]);
  });

  it('give new rows UUIDv7 ids', async () => {
    const ctx = await auth.$context;
    const user = await ctx.adapter.create<{ id: string }>({
      model: 'user',
      data: {
        name: 'Id Check',
        email: `id-check-${Date.now()}@example.test`,
        emailVerified: false,
      },
    });
    expect(user.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    await ctx.adapter.delete({ model: 'user', where: [{ field: 'id', value: user.id }] });
  });
});
