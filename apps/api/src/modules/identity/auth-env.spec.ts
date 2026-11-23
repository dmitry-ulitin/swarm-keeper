import { describe, expect, it } from 'vitest';
import { DEV_AUTH_SECRET, authEnv } from './auth-env.js';

const SECRET = 's'.repeat(32);

describe('authEnv', () => {
  it.each(['development', 'test'])('has dev defaults when NODE_ENV=%s', (NODE_ENV) => {
    expect(authEnv({ NODE_ENV })).toEqual({
      secret: DEV_AUTH_SECRET,
      baseURL: 'http://localhost:4200',
      passkeyRpId: 'localhost',
      secureCookies: false,
      trustedProxies: [],
    });
  });

  it('takes values from the environment', () => {
    expect(
      authEnv({
        BETTER_AUTH_SECRET: SECRET,
        BETTER_AUTH_URL: 'https://archive.example',
        PASSKEY_RP_ID: 'archive.example',
        TRUSTED_PROXIES: '10.0.0.0/8, 192.168.1.1',
      }),
    ).toEqual({
      secret: SECRET,
      baseURL: 'https://archive.example',
      passkeyRpId: 'archive.example',
      secureCookies: true,
      trustedProxies: ['10.0.0.0/8', '192.168.1.1'],
    });
  });

  // Fail closed: anything that is not explicitly development or test is treated as production.
  it.each([{}, { NODE_ENV: 'production' }, { NODE_ENV: 'staging' }])(
    'requires the settings outside development and test (%o)',
    (env) => {
      expect(() => authEnv({ ...env, BETTER_AUTH_URL: 'https://a' })).toThrow(
        /BETTER_AUTH_SECRET is required/,
      );
      expect(() => authEnv({ ...env, BETTER_AUTH_SECRET: SECRET, PASSKEY_RP_ID: 'a' })).toThrow(
        /BETTER_AUTH_URL is required/,
      );
      expect(() =>
        authEnv({ ...env, BETTER_AUTH_SECRET: SECRET, BETTER_AUTH_URL: 'https://a' }),
      ).toThrow(/PASSKEY_RP_ID is required/);
    },
  );

  it('refuses the published dev secret and short secrets outside development and test', () => {
    const base = { BETTER_AUTH_URL: 'https://a', PASSKEY_RP_ID: 'a' };
    expect(() => authEnv({ ...base, BETTER_AUTH_SECRET: DEV_AUTH_SECRET })).toThrow(/dev secret/);
    expect(() => authEnv({ ...base, BETTER_AUTH_SECRET: 'short' })).toThrow(/at least 32/);
  });
});
