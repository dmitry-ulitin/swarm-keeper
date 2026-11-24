// Test helpers for the auth specs (not exported from the library).
import type { AuthClientPort } from './auth-client';
import type { MeResponse } from './auth.service';

export const ME: MeResponse = {
  user: {
    id: 'u1',
    name: 'Анна',
    email: 'anna@example.test',
    locale: 'ru',
    uiSize: 'large',
    twoFactorEnabled: false,
    hasPassword: true,
  },
  families: [{ id: 'f1', name: 'Ивановы', role: 'admin' }],
  activeFamilyId: 'f1',
  role: 'admin',
  permissions: ['asset:read', 'asset:create'],
  twoFactorRequired: false,
};

export const ok = <T>(data: T) => Promise.resolve({ data, error: null });
export const fail = (code: string) => Promise.resolve({ data: null, error: { code, status: 401 } });

export function fakeClient(overrides: Partial<Record<string, unknown>> = {}): AuthClientPort {
  return {
    signIn: { passkey: () => ok({}), email: () => ok({}) },
    signUp: { email: () => ok({}) },
    twoFactor: twoFactor(),
    passkey: {
      addPasskey: () => ok({}),
      listUserPasskeys: () => ok([]),
      updatePasskey: () => ok({}),
      deletePasskey: () => ok({}),
    },
    organization: organization(),
    requestPasswordReset: () => ok({}),
    resetPassword: () => ok({}),
    signOut: () => ok({}),
    ...overrides,
  } as AuthClientPort;
}

/** The organization part of the fake client, with overrides. */
export function organization(overrides: Record<string, unknown> = {}) {
  return {
    acceptInvitation: () => ok({}),
    setActive: () => ok({}),
    listMembers: () => ok({ members: [], total: 0 }),
    listInvitations: () => ok([]),
    inviteMember: () => ok({}),
    cancelInvitation: () => ok({}),
    ...overrides,
  };
}

/** The twoFactor part of the fake client, with overrides. */
export function twoFactor(overrides: Record<string, unknown> = {}) {
  return {
    verifyTotp: () => ok({}),
    verifyBackupCode: () => ok({}),
    enable: () => ok({ totpURI: 'otpauth://totp/x?secret=JBSWY3DPEHPK3PXP', backupCodes: [] }),
    generateBackupCodes: () => ok({ backupCodes: [] }),
    disable: () => ok({}),
    ...overrides,
  };
}
