import { InjectionToken } from '@angular/core';
import { passkeyClient } from '@better-auth/passkey/client';
import { createAuthClient } from 'better-auth/client';
import { organizationClient, twoFactorClient } from 'better-auth/client/plugins';

/** What a Better Auth client call answers: data, or an error with a code. */
export interface AuthResult<T = unknown> {
  data: T | null;
  error: { code?: string; message?: string; status?: number } | null;
}

type Call<I = unknown, T = unknown> = (input: I) => Promise<AuthResult<T>>;

/**
 * The part of Better Auth's client the app uses. A port, so services and tests depend on
 * this shape rather than on the client's large generated types.
 */
export interface AuthClientPort {
  signIn: {
    passkey: Call<void>;
    email: Call<{ email: string; password: string }, { twoFactorRedirect?: boolean }>;
  };
  signUp: {
    email: Call<{
      email: string;
      password: string;
      name: string;
      inviteToken: string;
      locale: string;
    }>;
  };
  twoFactor: { verifyTotp: Call<{ code: string }>; verifyBackupCode: Call<{ code: string }> };
  passkey: { addPasskey: Call<{ context?: string; createSession?: boolean } | void> };
  organization: {
    acceptInvitation: Call<{ invitationId: string }>;
    setActive: Call<{ organizationId: string }>;
  };
  requestPasswordReset: Call<{ email: string; redirectTo: string }>;
  resetPassword: Call<{ newPassword: string; token: string }>;
  signOut: Call<void>;
}

/** Better Auth's client on the app's own origin (`/api/auth`, cookie session). */
export const AUTH_CLIENT = new InjectionToken<AuthClientPort>('AUTH_CLIENT', {
  providedIn: 'root',
  factory: () =>
    createAuthClient({
      baseURL: globalThis.location?.origin,
      basePath: '/api/auth',
      plugins: [passkeyClient(), twoFactorClient(), organizationClient()],
    }) as unknown as AuthClientPort,
});
