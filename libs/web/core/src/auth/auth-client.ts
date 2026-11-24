import { InjectionToken } from '@angular/core';

/** What a Better Auth client call answers: data, or an error with a code. */
export interface AuthResult<T = unknown> {
  data: T | null;
  error: { code?: string; message?: string; status?: number } | null;
}

/** A passkey of the signed-in user. */
export interface PasskeyView {
  id: string;
  name: string | null;
  createdAt: string;
}

/** A member of the active family, with their user. */
export interface MemberView {
  id: string;
  userId: string;
  role: string;
  createdAt: string;
  user: { name: string; email: string };
}

/** An invitation of the active family, in any status. */
export interface InvitationRow {
  id: string;
  email: string;
  role: string;
  status: string;
  expiresAt: string;
  locale: string | null;
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
  twoFactor: {
    verifyTotp: Call<{ code: string }>;
    verifyBackupCode: Call<{ code: string }>;
    enable: Call<{ password: string }, { totpURI: string; backupCodes: string[] }>;
    generateBackupCodes: Call<{ password: string }, { backupCodes: string[] }>;
    disable: Call<{ password: string }>;
  };
  passkey: {
    addPasskey: Call<{ context?: string; createSession?: boolean; name?: string } | void>;
    listUserPasskeys: Call<void, PasskeyView[]>;
    updatePasskey: Call<{ id: string; name: string }>;
    deletePasskey: Call<{ id: string }>;
  };
  organization: {
    acceptInvitation: Call<{ invitationId: string }>;
    setActive: Call<{ organizationId: string }>;
    listMembers: Call<{ query: { organizationId: string } }, { members: MemberView[] }>;
    listInvitations: Call<{ query: { organizationId: string } }, InvitationRow[]>;
    inviteMember: Call<{
      email: string;
      role: string;
      organizationId: string;
      locale: string;
      resend?: boolean;
    }>;
    cancelInvitation: Call<{ invitationId: string }>;
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
      enable: (input) => get().then((c) => c.twoFactor.enable(input)),
      generateBackupCodes: (input) => get().then((c) => c.twoFactor.generateBackupCodes(input)),
      disable: (input) => get().then((c) => c.twoFactor.disable(input)),
    },
    passkey: {
      addPasskey: (input) => get().then((c) => c.passkey.addPasskey(input)),
      listUserPasskeys: (input) => get().then((c) => c.passkey.listUserPasskeys(input)),
      updatePasskey: (input) => get().then((c) => c.passkey.updatePasskey(input)),
      deletePasskey: (input) => get().then((c) => c.passkey.deletePasskey(input)),
    },
    organization: {
      acceptInvitation: (input) => get().then((c) => c.organization.acceptInvitation(input)),
      setActive: (input) => get().then((c) => c.organization.setActive(input)),
      listMembers: (input) => get().then((c) => c.organization.listMembers(input)),
      listInvitations: (input) => get().then((c) => c.organization.listInvitations(input)),
      inviteMember: (input) => get().then((c) => c.organization.inviteMember(input)),
      cancelInvitation: (input) => get().then((c) => c.organization.cancelInvitation(input)),
    },
    requestPasswordReset: (input) => get().then((c) => c.requestPasswordReset(input)),
    resetPassword: (input) => get().then((c) => c.resetPassword(input)),
    signOut: (input) => get().then((c) => c.signOut(input)),
  };
}
