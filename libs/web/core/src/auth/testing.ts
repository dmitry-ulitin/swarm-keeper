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
    twoFactor: { verifyTotp: () => ok({}), verifyBackupCode: () => ok({}) },
    passkey: { addPasskey: () => ok({}) },
    organization: { acceptInvitation: () => ok({}), setActive: () => ok({}) },
    requestPasswordReset: () => ok({}),
    resetPassword: () => ok({}),
    signOut: () => ok({}),
    ...overrides,
  } as AuthClientPort;
}
