import { describe, expect, it } from 'vitest';
import { DEV_DATABASE_URL, databaseUrl, testDatabaseUrl } from './database-url.js';

describe('databaseUrl', () => {
  it('uses DATABASE_URL when set', () => {
    expect(databaseUrl({ DATABASE_URL: 'postgres://a/b' })).toBe('postgres://a/b');
  });

  it('falls back to the dev URL when DATABASE_URL is unset or empty', () => {
    expect(databaseUrl({})).toBe(DEV_DATABASE_URL);
    expect(databaseUrl({ DATABASE_URL: '' })).toBe(DEV_DATABASE_URL);
  });

  it('requires DATABASE_URL in production', () => {
    expect(() => databaseUrl({ NODE_ENV: 'production' })).toThrow(/DATABASE_URL is required/);
  });
});

describe('testDatabaseUrl', () => {
  it('swaps the database name and keeps everything else', () => {
    expect(testDatabaseUrl('postgres://u:p@h:5433/swarm_keeper?sslmode=disable')).toBe(
      'postgres://u:p@h:5433/swarm_keeper_test?sslmode=disable',
    );
  });
});
