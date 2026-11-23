/** Development and tests only: signs dev sessions. Refused anywhere else. */
export const DEV_AUTH_SECRET = 'dev-only-swarm-keeper-auth-secret-0123456789';

export interface AuthEnv {
  /** Signs cookies and tokens (BETTER_AUTH_SECRET), at least 32 characters. */
  secret: string;
  /** The origin the browser sees (BETTER_AUTH_URL); in dev the web app proxies /api. */
  baseURL: string;
  /** WebAuthn relying party ID: the app's domain (PASSKEY_RP_ID). */
  passkeyRpId: string;
  /** Secure cookies whenever the app is served over HTTPS. */
  secureCookies: boolean;
  /**
   * Proxies allowed to append to x-forwarded-for (TRUSTED_PROXIES, comma-separated IPs or CIDRs).
   * Empty: Better Auth trusts a single-value header only, so the proxy in front must overwrite it,
   * and the API must not be reachable around the proxy.
   */
  trustedProxies: string[];
}

/**
 * Auth settings from the environment. Fails closed: dev defaults apply only when NODE_ENV is
 * explicitly `development` or `test`; anything else, including an unset NODE_ENV, must set them.
 */
export function authEnv(env: NodeJS.ProcessEnv = process.env): AuthEnv {
  const dev = env['NODE_ENV'] === 'development' || env['NODE_ENV'] === 'test';
  const setting = (name: string, devDefault: string): string => {
    const value = env[name]?.trim();
    if (value) {
      return value;
    }
    if (!dev) {
      throw new Error(`${name} is required unless NODE_ENV is development or test`);
    }
    return devDefault;
  };

  const secret = setting('BETTER_AUTH_SECRET', DEV_AUTH_SECRET);
  if (!dev && secret === DEV_AUTH_SECRET) {
    throw new Error('BETTER_AUTH_SECRET must not be the published dev secret');
  }
  if (secret.length < 32) {
    throw new Error('BETTER_AUTH_SECRET must be at least 32 characters');
  }
  const baseURL = setting('BETTER_AUTH_URL', 'http://localhost:4200');

  return {
    secret,
    baseURL,
    passkeyRpId: setting('PASSKEY_RP_ID', 'localhost'),
    secureCookies: new URL(baseURL).protocol === 'https:',
    trustedProxies: (env['TRUSTED_PROXIES'] ?? '')
      .split(',')
      .map((proxy) => proxy.trim())
      .filter(Boolean),
  };
}
