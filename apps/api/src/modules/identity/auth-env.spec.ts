import { describe, expect, it } from 'vitest';
import { DEV_AUTH_SECRET, authEnv } from './auth-env.js';

describe('authEnv', () => {
  it('has dev defaults', () => {
    expect(authEnv({})).toEqual({
      secret: DEV_AUTH_SECRET,
      baseURL: 'http://localhost:4200',
      passkeyRpId: 'localhost',
    });
  });

  it('takes values from the environment', () => {
    expect(
      authEnv({
        BETTER_AUTH_SECRET: 's'.repeat(32),
        BETTER_AUTH_URL: 'https://archive.example',
        PASSKEY_RP_ID: 'archive.example',
      }),
    ).toEqual({
      secret: 's'.repeat(32),
      baseURL: 'https://archive.example',
      passkeyRpId: 'archive.example',
    });
  });

  it('requires the secret and the URL in production', () => {
    expect(() => authEnv({ NODE_ENV: 'production', BETTER_AUTH_URL: 'https://a' })).toThrow(
      /BETTER_AUTH_SECRET is required in production/,
    );
    expect(() => authEnv({ NODE_ENV: 'production', BETTER_AUTH_SECRET: 's'.repeat(32) })).toThrow(
      /BETTER_AUTH_URL is required in production/,
    );
  });
});
