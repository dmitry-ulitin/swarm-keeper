import { type QueryExecutorProvider, sql } from 'kysely';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDatabase } from './create-database.js';
import { databaseOwnerUrl, databaseUrl } from './database-url.js';
import { type FamilyContext, FamilyDb } from './family-db.js';

// rls_probe stands in for an archive table: created by the owner and put under the family policy
// with enable_family_rls, as archive migrations will do; used through the application role.
describe('FamilyDb and the family policy', () => {
  const owner = createDatabase(databaseOwnerUrl());
  // One connection, so every test reuses the connection the previous one left behind.
  const app = createDatabase(databaseUrl(), { max: 1 });
  const familyDb = new FamilyDb(app);
  const ctxA: FamilyContext = {
    familyId: '01900000-0000-7000-8000-00000000000a',
    userId: '01900000-0000-7000-8000-0000000000a1',
  };
  const ctxB: FamilyContext = {
    familyId: '01900000-0000-7000-8000-00000000000b',
    userId: '01900000-0000-7000-8000-0000000000b1',
  };

  const count = async (db: QueryExecutorProvider) =>
    Number((await sql<{ n: string }>`select count(*) as n from rls_probe`.execute(db)).rows[0]?.n);
  const notes = async (db: QueryExecutorProvider) =>
    (await sql<{ note: string }>`select note from rls_probe order by note`.execute(db)).rows.map(
      (r) => r.note,
    );
  const insert = (db: QueryExecutorProvider, familyId: string | null) =>
    sql`insert into rls_probe (family_id, note) values (${familyId}::uuid, 'new')`.execute(db);
  const setting = async (db: QueryExecutorProvider, name: string) =>
    (await sql<{ v: string }>`select current_setting(${name}, true) as v`.execute(db)).rows[0]?.v;

  beforeAll(async () => {
    await sql`create table rls_probe (id uuid default uuidv7() primary key, family_id uuid, note text)`.execute(
      owner,
    );
    await sql`select enable_family_rls('rls_probe')`.execute(owner);
    // The owner is the compose superuser here, so it writes past the policy.
    await sql`insert into rls_probe (family_id, note) values (${ctxA.familyId}::uuid, 'a'), (${ctxB.familyId}::uuid, 'b')`.execute(
      owner,
    );
  });

  afterAll(async () => {
    await sql`drop table if exists rls_probe`.execute(owner);
    await app.destroy();
    await owner.destroy();
  });

  it('shows nothing and accepts nothing outside run', async () => {
    expect(await count(app)).toBe(0);
    await expect(insert(app, ctxA.familyId)).rejects.toThrow(/row-level security/);
  });

  it('shows only the family of the context', async () => {
    expect(await familyDb.run(ctxA, (trx) => notes(trx))).toEqual(['a']);
    expect(await familyDb.run(ctxB, (trx) => notes(trx))).toEqual(['b']);
  });

  it('accepts a row for the family of the context', async () => {
    await familyDb.run(ctxA, async (trx) => {
      await insert(trx, ctxA.familyId);
      expect(await notes(trx)).toEqual(['a', 'new']);
      await sql`delete from rls_probe where note = 'new'`.execute(trx);
    });
  });

  it('rejects a row for another family or without one', async () => {
    await expect(familyDb.run(ctxA, (trx) => insert(trx, ctxB.familyId))).rejects.toThrow(
      /row-level security/,
    );
    await expect(familyDb.run(ctxA, (trx) => insert(trx, null))).rejects.toThrow(
      /row-level security/,
    );
  });

  it('leaves nothing on the pooled connection, after commit or after a throw', async () => {
    await familyDb.run(ctxA, (trx) => notes(trx));
    expect(await count(app)).toBe(0);
    await expect(
      familyDb.run(ctxA, async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    expect(await count(app)).toBe(0);
    expect(await setting(app, 'app.family_id')).toBeFalsy();
    expect(await familyDb.run(ctxB, (trx) => notes(trx))).toEqual(['b']);
  });

  it('sets app.user_id', async () => {
    expect(await familyDb.run(ctxA, (trx) => setting(trx, 'app.user_id'))).toBe(ctxA.userId);
  });

  it('refuses an id that is not a UUID', async () => {
    await expect(
      familyDb.run({ familyId: 'x', userId: ctxA.userId }, (trx) => notes(trx)),
    ).rejects.toThrow(/UUID/);
    await expect(
      familyDb.run({ familyId: ctxA.familyId, userId: "'; drop table x; --" }, (trx) => notes(trx)),
    ).rejects.toThrow(/UUID/);
  });

  it('cannot be used by the application role to change a policy', async () => {
    await expect(sql`select enable_family_rls('rls_probe')`.execute(app)).rejects.toThrow(
      /permission denied/,
    );
  });
});
