import { getAuthTables } from 'better-auth/db';
import { describe, expect, it } from 'vitest';
import { authEnv } from './auth-env.js';
import { authOptions } from './create-auth.js';
import { LoggingMailer } from './mailer.js';
import { toSnakeCase } from './snake-case-schema.js';

describe('toSnakeCase', () => {
  it.each([
    ['emailVerified', 'email_verified'],
    ['twoFactor', 'two_factor'],
    ['id', 'id'],
    ['accessTokenExpiresAt', 'access_token_expires_at'],
    ['credentialID', 'credential_id'],
    ['IDToken', 'id_token'],
  ])('%s → %s', (input, output) => {
    expect(toSnakeCase(input)).toBe(output);
  });
});

describe('Better Auth schema', () => {
  // Fails when a Better Auth update adds a model or field the mapping does not cover.
  it('names every table and column in snake_case', () => {
    const tables = getAuthTables(authOptions(authEnv({}), new LoggingMailer()));
    const names = Object.values(tables).flatMap((table) => [
      table.modelName,
      ...Object.entries(table.fields).map(([key, field]) => field.fieldName ?? key),
    ]);
    expect(names.length).toBeGreaterThan(40);
    expect(names.filter((name) => !/^[a-z][a-z0-9_]*$/.test(name))).toEqual([]);
  });
});
