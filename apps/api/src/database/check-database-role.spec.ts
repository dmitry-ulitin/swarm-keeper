import { afterAll, describe, expect, it, vi } from 'vitest';
import { checkDatabaseRole, watchDatabaseRole } from './check-database-role.js';
import { createDatabase } from './create-database.js';
import { databaseOwnerUrl, databaseUrl } from './database-url.js';

describe('checkDatabaseRole', () => {
  const appDb = createDatabase(databaseUrl());
  // The dev and CI owner is the compose superuser.
  const ownerDb = createDatabase(databaseOwnerUrl());

  afterAll(async () => {
    await appDb.destroy();
    await ownerDb.destroy();
  });

  it('accepts the application role', async () => {
    await expect(checkDatabaseRole(appDb, { NODE_ENV: 'production' })).resolves.toBeUndefined();
  });

  it('refuses a superuser outside development', async () => {
    await expect(checkDatabaseRole(ownerDb, { NODE_ENV: 'production' })).rejects.toThrow(
      /swarm_keeper_app/,
    );
    await expect(checkDatabaseRole(ownerDb, { NODE_ENV: 'test' })).rejects.toThrow();
  });

  it('only warns about a superuser in development', async () => {
    const warn = vi.fn();
    await checkDatabaseRole(ownerDb, { NODE_ENV: 'development' }, { warn });
    expect(warn).toHaveBeenCalledOnce();
  });

  describe('watchDatabaseRole', () => {
    it('throws at once for a reachable superuser outside development', async () => {
      await expect(watchDatabaseRole(ownerDb, { env: { NODE_ENV: 'test' } })).rejects.toThrow(
        /bypasses RLS/,
      );
    });

    it('retries in the background while the database is unreachable', async () => {
      const unreachable = createDatabase('postgres://swarm:swarm@127.0.0.1:1/swarm_keeper_test');
      const warn = vi.fn();
      const onFatal = vi.fn();
      const watch = await watchDatabaseRole(unreachable, {
        env: { NODE_ENV: 'test' },
        logger: { warn, error: vi.fn() },
        retryMs: 10,
        onFatal,
      });
      await vi.waitFor(() => expect(warn.mock.calls.length).toBeGreaterThanOrEqual(2));
      watch.stop();
      expect(onFatal).not.toHaveBeenCalled();
      await unreachable.destroy();
    });

    it('stops the process when a retry finds a role that bypasses RLS', async () => {
      // A database that refuses the first check and then answers as the superuser.
      let calls = 0;
      const flaky = {
        getExecutor: () => {
          calls += 1;
          if (calls === 1) {
            throw Object.assign(new Error('connect ECONNREFUSED'), { code: 'ECONNREFUSED' });
          }
          return ownerDb.getExecutor();
        },
      } as unknown as typeof ownerDb;
      const onFatal = vi.fn();
      const watch = await watchDatabaseRole(flaky, {
        env: { NODE_ENV: 'production' },
        logger: { warn: vi.fn(), error: vi.fn() },
        retryMs: 10,
        onFatal,
      });
      await vi.waitFor(() => expect(onFatal).toHaveBeenCalledOnce());
      watch.stop();
    });
  });
});
