import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router, provideRouter } from '@angular/router';
import { provideTranslocoScope } from '@jsverse/transloco';
import { AppearanceService, AuthService, provideWebCore } from '@swarm-keeper/web-core';
import { provideIcons } from '@swarm-keeper/web-ui';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { PasswordDialog } from './password.dialog';
import { SecurityPage } from './security.page';
import { FEATURE, ME, errorText, fakeAuth, fileLoader, literalText, rejectWith } from './testing';
import { TwoFactorDialog } from './two-factor.dialog';

const SESSIONS = [
  {
    id: 's1',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/131.0.0.0 Safari/537.36',
    ipAddress: '192.168.1.5',
    createdAt: '2026-11-24T10:00:00.000Z',
    updatedAt: '2026-11-24T10:00:00.000Z',
    current: true,
  },
  {
    id: 's2',
    userAgent: null,
    ipAddress: null,
    createdAt: '2026-11-20T10:00:00.000Z',
    updatedAt: '2026-11-20T10:00:00.000Z',
    current: false,
  },
];

async function render(auth = fakeAuth(), confirm = true, sessions: object | 500 = SESSIONS) {
  const open = vi.fn(() => ({ afterClosed: () => of(confirm) }));
  const snack = vi.fn();
  TestBed.configureTestingModule({
    providers: [
      provideWebCore(),
      provideHttpClient(),
      provideHttpClientTesting(),
      provideRouter([]),
      provideIcons(),
      fileLoader,
      provideTranslocoScope('settings'),
      { provide: AuthService, useValue: auth },
      { provide: MatDialog, useValue: { open } },
      { provide: MatSnackBar, useValue: { open: snack } },
    ],
  });
  TestBed.inject(AppearanceService).setLang('ru');
  const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
  const fixture = TestBed.createComponent(SecurityPage);
  TestBed.tick();
  const req = TestBed.inject(HttpTestingController).expectOne('/api/v1/me/sessions');
  if (sessions === 500) req.flush({}, { status: 500, statusText: 'Server Error' });
  else req.flush(sessions);
  await fixture.whenStable();
  const el = fixture.nativeElement as HTMLElement;
  const click = async (selector: string) => {
    (el.querySelector(selector) as HTMLElement).click();
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve));
    await fixture.whenStable();
  };
  return { auth, open, snack, navigate, fixture, el, click };
}

describe('SecurityPage', () => {
  it('shows no 2FA section to a passkey-only user', async () => {
    const { el } = await render(fakeAuth({ ...ME, user: { ...ME.user, hasPassword: false } }));
    expect(el.querySelector('[data-test="two-factor"]')).toBeNull();
    expect(el.querySelector('[data-test="passkeys"]')).not.toBeNull();
  });

  it('offers to enable 2FA to a password user without it', async () => {
    const { el, open, click } = await render();
    await click('[data-test="enable-2fa"]');
    expect(open).toHaveBeenCalledWith(TwoFactorDialog, expect.anything());
    expect(el.querySelector('[data-test="disable-2fa"]')).toBeNull();
  });

  it('warns an owner before disabling 2FA', async () => {
    const { open, click } = await render(
      fakeAuth({ ...ME, user: { ...ME.user, twoFactorEnabled: true } }),
    );
    await click('[data-test="disable-2fa"]');
    expect(open).toHaveBeenCalledWith(
      PasswordDialog,
      expect.objectContaining({
        data: expect.objectContaining({ warningKey: expect.any(String) }),
      }),
    );
  });

  it('puts the current session first with no End button', async () => {
    const { el } = await render();
    const rows = el.querySelectorAll('[data-test="session"]');
    expect(rows).toHaveLength(2);
    expect(rows[0]?.textContent).toContain('Chrome');
    expect(rows[0]?.querySelector('[data-test="end-session"]')).toBeNull();
    expect(rows[1]?.querySelector('[data-test="end-session"]')).not.toBeNull();
  });

  it('asks a stale session to sign in again before adding a passkey', async () => {
    const auth = fakeAuth();
    auth.addPasskey.mockImplementation(rejectWith('SESSION_NOT_FRESH'));
    const { navigate, click } = await render(auth);
    await click('[data-test="add-passkey"]');
    expect(auth.signOut).toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith('/login?returnUrl=%2Fsettings%2Fsecurity');
  });

  it('explains why the last sign-in method stays', async () => {
    const auth = fakeAuth();
    auth.deletePasskey.mockImplementation(rejectWith('LAST_SIGN_IN_METHOD'));
    const { snack, click } = await render(auth);
    await click('[data-test="delete-passkey"]');
    expect(snack).toHaveBeenCalledWith(
      errorText('ru')['LAST_SIGN_IN_METHOD'],
      undefined,
      expect.anything(),
    );
  });

  it('shows an error with a retry when the lists fail to load', async () => {
    const auth = fakeAuth();
    auth.listPasskeys.mockImplementation(rejectWith('TOO_MANY_REQUESTS'));
    const { el } = await render(auth, true, 500);
    await new Promise((resolve) => setTimeout(resolve));
    expect(el.querySelector('[data-test="passkeys-error"]')).not.toBeNull();
    expect(el.querySelector('[data-test="sessions-error"]')).not.toBeNull();
    expect(el.querySelector('[data-test="session"]')).toBeNull();
  });

  it('has no literal text in its template', () => {
    expect(literalText(`${FEATURE}/security.page.html`)).toBe('');
  });
});
