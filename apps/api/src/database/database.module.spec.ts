import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import { sql } from 'kysely';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DATABASE, type Database, DatabaseModule } from './database.module.js';

async function start() {
  const moduleRef = await Test.createTestingModule({ imports: [DatabaseModule] }).compile();
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

  it('starts without a reachable database; only queries fail', async () => {
    vi.stubEnv('DATABASE_URL', 'postgres://swarm:swarm@127.0.0.1:1/swarm_keeper_test');
    const { app, db } = await start();
    await expect(sql`select 1`.execute(db)).rejects.toThrow();
    await app.close();
  });
});
