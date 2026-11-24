import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppearanceService } from '../appearance.service';
import { AUTH_CLIENT, type AuthClientPort } from './auth-client';
import { AuthError, AuthService } from './auth.service';

import { ME, fail, fakeClient, ok, organization, twoFactor } from './testing';

describe('AuthService', () => {
  let http: HttpTestingController;

  function setup(client: AuthClientPort = fakeClient()) {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AUTH_CLIENT, useValue: client },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    return TestBed.inject(AuthService);
  }

  beforeEach(() => TestBed.resetTestingModule());

  it('loads /me into signals and applies the language and size', async () => {
    const auth = setup();
    const done = auth.refresh();
    http.expectOne('/api/v1/me').flush(ME);
    await done;
    expect(auth.signedIn()).toBe(true);
    expect(auth.permissions()).toEqual(['asset:read', 'asset:create']);
    expect(auth.activeFamily()?.name).toBe('Ивановы');
    const appearance = TestBed.inject(AppearanceService);
    expect(appearance.lang()).toBe('ru');
    expect(appearance.uiSize()).toBe('large');
  });

  it('is signed out after a 401', async () => {
    const auth = setup();
    const done = auth.refresh();
    http
      .expectOne('/api/v1/me')
      .flush({ code: 'UNAUTHENTICATED', params: {} }, { status: 401, statusText: 'Unauthorized' });
    await done;
    expect(auth.signedIn()).toBe(false);
  });

  it('reports a second factor after a password', async () => {
    const auth = setup(
      fakeClient({
        signIn: { passkey: () => ok({}), email: () => ok({ twoFactorRedirect: true }) },
      }),
    );
    await expect(auth.signInPassword('a@example.test', 'x')).resolves.toBe('two-factor');
  });

  it('rejects with the error code', async () => {
    const auth = setup(
      fakeClient({
        signIn: { passkey: () => ok({}), email: () => fail('INVALID_EMAIL_OR_PASSWORD') },
      }),
    );
    const error = await auth.signInPassword('a@example.test', 'x').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(AuthError);
    expect((error as AuthError).code).toBe('INVALID_EMAIL_OR_PASSWORD');
  });

  it('signs up with a passkey, sending the invitation context, then loads /me', async () => {
    let seen: unknown;
    const auth = setup(
      fakeClient({ passkey: { addPasskey: (opts: unknown) => ((seen = opts), ok({})) } }),
    );
    const done = auth.signUpPasskey({ invitationId: 'i1', name: 'Валя', locale: 'ru' });
    await new Promise((resolve) => setTimeout(resolve));
    http.expectOne('/api/v1/me').flush(ME);
    await done;
    expect(seen).toEqual({
      context: JSON.stringify({ invitation: 'i1', name: 'Валя', locale: 'ru' }),
      createSession: true,
    });
    expect(auth.signedIn()).toBe(true);
  });

  describe('/me errors', () => {
    async function signedIn(auth: AuthService) {
      const done = auth.refresh();
      http.expectOne('/api/v1/me').flush(ME);
      await done;
    }

    it('keeps the session after a server error and reports it', async () => {
      const auth = setup();
      await signedIn(auth);
      const done = auth.refresh();
      http.expectOne('/api/v1/me').flush({}, { status: 500, statusText: 'Server Error' });
      await done;
      expect(auth.signedIn()).toBe(true);
      expect(auth.loadError()).toBe(true);
    });

    it('signs out on a 401 after being signed in', async () => {
      const auth = setup();
      await signedIn(auth);
      expect(auth.loadError()).toBe(false);
      const done = auth.refresh();
      http.expectOne('/api/v1/me').flush({}, { status: 401, statusText: 'Unauthorized' });
      await done;
      expect(auth.signedIn()).toBe(false);
      expect(auth.loadError()).toBe(false);
    });
  });

  describe('family invitations', () => {
    const ROW = {
      id: 'i1',
      email: 'bob@example.test',
      role: 'member',
      status: 'pending',
      locale: 'en',
    };
    const future = new Date(Date.now() + 86_400_000).toISOString();
    const past = new Date(Date.now() - 86_400_000).toISOString();

    async function withFamily(client: AuthClientPort) {
      const auth = setup(client);
      const done = auth.refresh();
      http.expectOne('/api/v1/me').flush(ME);
      await done;
      return auth;
    }

    it('resends a valid invitation with resend: true and never cancels', async () => {
      const inviteMember = vi.fn(() => ok({}));
      const cancelInvitation = vi.fn(() => ok({}));
      const auth = await withFamily(fakeClient({ organization: organization({ inviteMember, cancelInvitation }) }));
      await auth.resendInvitation({ ...ROW, expiresAt: future });
      expect(inviteMember).toHaveBeenCalledTimes(1);
      expect(inviteMember).toHaveBeenCalledWith({
        email: 'bob@example.test',
        role: 'member',
        organizationId: 'f1',
        locale: 'en',
        resend: true,
      });
      expect(cancelInvitation).not.toHaveBeenCalled();
    });

    it('replaces an expired invitation with a new one, then cancels the old', async () => {
      const calls: string[] = [];
      const inviteMember = vi.fn((input: object) => {
        calls.push('invite');
        expect(input).not.toHaveProperty('resend');
        return ok({});
      });
      const cancelInvitation = vi.fn(() => {
        calls.push('cancel');
        return ok({});
      });
      const auth = await withFamily(fakeClient({ organization: organization({ inviteMember, cancelInvitation }) }));
      await auth.resendInvitation({ ...ROW, expiresAt: past });
      expect(calls).toEqual(['invite', 'cancel']);
      expect(cancelInvitation).toHaveBeenCalledWith({ invitationId: 'i1' });
    });

    it('still resolves when cancelling the expired invitation fails', async () => {
      const auth = await withFamily(
        fakeClient({ organization: organization({ cancelInvitation: () => fail('FORBIDDEN') }) }),
      );
      await expect(auth.resendInvitation({ ...ROW, expiresAt: past })).resolves.toBeUndefined();
    });

    it('rejects with the code when the invitation cannot be sent', async () => {
      const auth = await withFamily(
        fakeClient({
          organization: organization({ inviteMember: () => fail('TWO_FACTOR_REQUIRED') }),
        }),
      );
      await expect(auth.resendInvitation({ ...ROW, expiresAt: future })).rejects.toEqual(
        new AuthError('TWO_FACTOR_REQUIRED'),
      );
    });
  });

  describe('two-factor', () => {
    it('starts 2FA with the password and returns the URI and codes', async () => {
      const enable = vi.fn(() => ok({ totpURI: 'otpauth://totp/x?secret=ABC', backupCodes: ['a', 'b'] }));
      const auth = setup(fakeClient({ twoFactor: twoFactor({ enable }) }));
      await expect(auth.startTwoFactor('secret password')).resolves.toEqual({
        totpURI: 'otpauth://totp/x?secret=ABC',
        backupCodes: ['a', 'b'],
      });
      expect(enable).toHaveBeenCalledWith({ password: 'secret password' });
    });

    it('reloads /me after disabling 2FA', async () => {
      const auth = setup();
      const done = auth.disableTwoFactor('secret password');
      await new Promise((resolve) => setTimeout(resolve));
      http.expectOne('/api/v1/me').flush(ME);
      await done;
      expect(auth.signedIn()).toBe(true);
    });
  });
});
