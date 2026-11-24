import { passkeyClient } from '@better-auth/passkey/client';
import { createAuthClient } from 'better-auth/client';
import { organizationClient, twoFactorClient } from 'better-auth/client/plugins';
import type { AuthClientPort } from './auth-client';

/** The real Better Auth client; imported lazily through AUTH_CLIENT. */
export function createBetterAuthClient(): AuthClientPort {
  return createAuthClient({
    baseURL: globalThis.location?.origin,
    basePath: '/api/auth',
    plugins: [passkeyClient(), twoFactorClient(), organizationClient()],
  }) as unknown as AuthClientPort;
}
