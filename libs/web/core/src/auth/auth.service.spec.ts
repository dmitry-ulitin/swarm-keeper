import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { AppearanceService } from '../appearance.service';
import { AUTH_CLIENT, type AuthClientPort } from './auth-client';
import { AuthError, AuthService } from './auth.service';

import { ME, fail, fakeClient, ok } from './testing';

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
});
