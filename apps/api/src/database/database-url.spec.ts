import { describe, expect, it } from 'vitest';
import {
  DEV_DATABASE_URL,
  databaseOwnerUrl,
  databaseUrl,
  testDatabaseUrl,
} from './database-url.js';

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

describe('databaseOwnerUrl', () => {
  it('defaults the owner URL to the swarm superuser and the app URL to swarm_app', () => {
    expect(databaseOwnerUrl({})).toBe('postgres://swarm:swarm@127.0.0.1:5432/swarm_keeper');
    expect(databaseUrl({})).toBe('postgres://swarm_app:swarm_app@127.0.0.1:5432/swarm_keeper');
  });

  it('uses DATABASE_OWNER_URL when set', () => {
    expect(databaseOwnerUrl({ DATABASE_OWNER_URL: 'postgres://o/b' })).toBe('postgres://o/b');
  });

  it('requires DATABASE_OWNER_URL in production', () => {
    expect(() => databaseOwnerUrl({ NODE_ENV: 'production' })).toThrow(/DATABASE_OWNER_URL/);
  });
});

describe('testDatabaseUrl', () => {
  it('swaps the database name and keeps everything else', () => {
    expect(testDatabaseUrl('postgres://u:p@h:5433/swarm_keeper?sslmode=disable')).toBe(
      'postgres://u:p@h:5433/swarm_keeper_test?sslmode=disable',
    );
  });
});
