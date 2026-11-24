import { InjectionToken } from '@angular/core';

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

/**
 * Better Auth's client on the app's own origin (`/api/auth`, cookie session). Loaded on the
 * first call, so the sign-in code stays out of the initial bundle.
 */
export const AUTH_CLIENT = new InjectionToken<AuthClientPort>('AUTH_CLIENT', {
  providedIn: 'root',
  factory: () =>
    lazyPort(() => import('./better-auth-client').then((m) => m.createBetterAuthClient())),
});

/** A port whose calls load the real client once, then delegate to it. */
export function lazyPort(load: () => Promise<AuthClientPort>): AuthClientPort {
  let client: Promise<AuthClientPort> | undefined;
  const get = () => (client ??= load());
  return {
    signIn: {
      passkey: (input) => get().then((c) => c.signIn.passkey(input)),
      email: (input) => get().then((c) => c.signIn.email(input)),
    },
    signUp: { email: (input) => get().then((c) => c.signUp.email(input)) },
    twoFactor: {
      verifyTotp: (input) => get().then((c) => c.twoFactor.verifyTotp(input)),
      verifyBackupCode: (input) => get().then((c) => c.twoFactor.verifyBackupCode(input)),
    },
    passkey: { addPasskey: (input) => get().then((c) => c.passkey.addPasskey(input)) },
    organization: {
      acceptInvitation: (input) => get().then((c) => c.organization.acceptInvitation(input)),
      setActive: (input) => get().then((c) => c.organization.setActive(input)),
    },
    requestPasswordReset: (input) => get().then((c) => c.requestPasswordReset(input)),
    resetPassword: (input) => get().then((c) => c.resetPassword(input)),
    signOut: (input) => get().then((c) => c.signOut(input)),
  };
}
