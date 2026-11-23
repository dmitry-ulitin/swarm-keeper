/** Development only: signs dev sessions. Production must set BETTER_AUTH_SECRET. */
export const DEV_AUTH_SECRET = 'dev-only-swarm-keeper-auth-secret-0123456789';

export interface AuthEnv {
  /** Signs cookies and encrypts secrets (BETTER_AUTH_SECRET). */
  secret: string;
  /** The origin the browser sees (BETTER_AUTH_URL); in dev the web app proxies /api. */
  baseURL: string;
  /** WebAuthn relying party ID: the app's domain (PASSKEY_RP_ID). */
  passkeyRpId: string;
}

function required(env: NodeJS.ProcessEnv, name: string, devDefault: string): string {
  const value = env[name];
  if (value) {
    return value;
  }
  if (env['NODE_ENV'] === 'production') {
    throw new Error(`${name} is required in production`);
  }
  return devDefault;
}

export function authEnv(env: NodeJS.ProcessEnv = process.env): AuthEnv {
  return {
    secret: required(env, 'BETTER_AUTH_SECRET', DEV_AUTH_SECRET),
    baseURL: required(env, 'BETTER_AUTH_URL', 'http://localhost:4200'),
    passkeyRpId: env['PASSKEY_RP_ID'] || 'localhost',
  };
}
