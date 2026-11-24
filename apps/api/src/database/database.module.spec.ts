import 'reflect-metadata';
import { type BeforeApplicationShutdown, Inject, Injectable } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { sql } from 'kysely';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DATABASE, type Database, DatabaseModule } from './database.module.js';

/** Stands in for work that finishes during shutdown, such as in-flight HTTP requests. */
@Injectable()
class LateQuery implements BeforeApplicationShutdown {
  result: unknown;
  constructor(@Inject(DATABASE) private readonly db: Database) {}
  async beforeApplicationShutdown(): Promise<void> {
    this.result = await sql`select 1 as one`.execute(this.db).then(
      (r) => r.rows,
      (e: unknown) => e,
    );
  }
}

async function start(providers: (typeof LateQuery)[] = []) {
  const moduleRef = await Test.createTestingModule({
    imports: [DatabaseModule],
    providers,
  }).compile();
  const app = moduleRef.createNestApplication({ logger: false });
  await app.init();
  return { app, db: app.get<Database>(DATABASE) };
}

describe('DatabaseModule', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('provides a working connection', async () => {
    const { app, db } = await start();
    const { rows } = await sql<{ one: number }>`select 1 as one`.execute(db);
    expect(rows).toEqual([{ one: 1 }]);
    await app.close();
  });

  it('ends the pool when the application closes', async () => {
    const { app, db } = await start();
    await sql`select 1`.execute(db);
    await app.close();
    await expect(sql`select 1`.execute(db)).rejects.toThrow();
  });

  it('keeps the pool open until shutdown work has finished', async () => {
    const { app, db } = await start([LateQuery]);
    const late = app.get(LateQuery);
    await sql`select 1`.execute(db); // Kysely's destroy() is a no-op until the first query.
    await app.close();
    expect(late.result).toEqual([{ one: 1 }]);
  });

  it('starts without a reachable database; only queries fail', async () => {
    vi.stubEnv('DATABASE_URL', 'postgres://swarm:swarm@127.0.0.1:1/swarm_keeper_test');
    const { app, db } = await start();
    await expect(sql`select 1`.execute(db)).rejects.toThrow();
    await app.close();
  });

  it('refuses to start as a superuser outside development', async () => {
    vi.stubEnv('DATABASE_URL', String(process.env['DATABASE_OWNER_URL']));
    await expect(start()).rejects.toThrow(/bypasses RLS/);
  });
});
