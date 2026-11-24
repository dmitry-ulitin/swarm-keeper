import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { provideTranslocoScope } from '@jsverse/transloco';
import { AppearanceService, AuthService, provideWebCore } from '@swarm-keeper/web-core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { InvitationView } from '../data-access';
import { InvitePage } from './invite.page';
import { ME, fakeAuth, fileLoader, literalText, rejectWith } from './testing';

const ID = '0193a000-0000-7000-8000-00000000abcd';
const INVITATION: InvitationView = {
  email: 'valya@example.test',
  familyName: 'Ивановы',
  inviterName: 'Анна',
  role: 'member',
  locale: 'ru',
  expiresAt: '2026-12-01T12:00:00.000Z',
  hasAccount: false,
};

describe('InvitePage', () => {
  let auth: ReturnType<typeof fakeAuth>;
  let navigate: ReturnType<typeof vi.fn>;
  let http: HttpTestingController;

  async function render(invitation: InvitationView | 404 = INVITATION) {
    TestBed.configureTestingModule({
      providers: [
        provideWebCore(),
        provideHttpClientTesting(),
        provideRouter([]),
        fileLoader,
        provideTranslocoScope('auth'),
        { provide: AuthService, useValue: auth },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true) as never;
    const fixture = TestBed.createComponent(InvitePage);
    fixture.componentRef.setInput('token', ID);
    TestBed.tick();
    flush(invitation);
    await fixture.whenStable();
    return fixture;
  }

  function flush(invitation: InvitationView | 404) {
    const req = http.expectOne(`/api/v1/invitations/${ID}`);
    if (invitation === 404) {
      req.flush(
        { code: 'INVITATION_NOT_FOUND', params: {} },
        { status: 404, statusText: 'Not Found' },
      );
    } else {
      req.flush(invitation);
    }
  }

  const el = (f: { nativeElement: HTMLElement }, hook: string) =>
    f.nativeElement.querySelector(`[data-test="${hook}"]`) as HTMLInputElement | null;

  async function type(
    f: { nativeElement: HTMLElement; whenStable(): Promise<unknown> },
    hook: string,
    value: string,
  ) {
    const input = el(f, hook)!;
    input.value = value;
    input.dispatchEvent(new Event('input'));
    await f.whenStable();
  }

  async function click(
    f: { nativeElement: HTMLElement; whenStable(): Promise<unknown> },
    hook: string,
  ) {
    el(f, hook)!.click();
    await f.whenStable();
  }

  beforeEach(() => {
    TestBed.resetTestingModule();
    auth = fakeAuth();
  });

  it('opens in the invitation language with the family, email and role', async () => {
    const f = await render();
    expect(TestBed.inject(AppearanceService).lang()).toBe('ru');
    expect(el(f, 'title')?.textContent).toContain('Ивановы');
    expect(el(f, 'email')?.readOnly).toBe(true);
    expect(el(f, 'email')?.value).toBe('valya@example.test');
    expect(el(f, 'role')?.textContent?.trim()).toBe('Роль: Участник');
  });

  it('signs up with a passkey once a name is given, in the current language', async () => {
    const f = await render();
    await click(f, 'passkey-sign-up');
    expect(auth.signUpPasskey).not.toHaveBeenCalled();
    await type(f, 'name', 'Бабушка Валя');
    await click(f, 'passkey-sign-up');
    expect(auth.signUpPasskey).toHaveBeenCalledWith({
      invitationId: ID,
      name: 'Бабушка Валя',
      locale: 'ru',
    });
    expect(navigate).toHaveBeenCalledWith('/');
  });

  it('sends the language the visitor switched to', async () => {
    const f = await render();
    await click(f, 'lang-en');
    await type(f, 'name', 'Valya');
    await click(f, 'passkey-sign-up');
    expect(auth.signUpPasskey).toHaveBeenCalledWith(expect.objectContaining({ locale: 'en' }));
  });

  it('signs up with a password and then offers a passkey', async () => {
    const f = await render();
    await click(f, 'show-password');
    await type(f, 'name', 'Валя');
    await type(f, 'password', 'correct horse battery');
    await click(f, 'submit');
    expect(auth.signUpPassword).toHaveBeenCalledWith({
      invitationId: ID,
      email: 'valya@example.test',
      name: 'Валя',
      password: 'correct horse battery',
      locale: 'ru',
    });
    expect(el(f, 'add-passkey')).not.toBeNull();
    await click(f, 'later');
    expect(navigate).toHaveBeenCalledWith('/');
  });

  it('asks an existing account to sign in first', async () => {
    const f = await render({ ...INVITATION, hasAccount: true });
    const link = f.nativeElement.querySelector('[data-test="sign-in-to-accept"]') as HTMLElement;
    link.click();
    await f.whenStable();
    expect(navigate).toHaveBeenCalledWith(
      `/login?returnUrl=${encodeURIComponent(`/invite/${ID}`)}`,
    );
  });

  it('lets the invited member accept', async () => {
    auth = fakeAuth({ ...ME, user: { ...ME.user, email: 'Valya@Example.test' } });
    const f = await render({ ...INVITATION, hasAccount: true });
    await click(f, 'accept');
    expect(auth.acceptInvitation).toHaveBeenCalledWith(ID);
    expect(navigate).toHaveBeenCalledWith('/');
  });

  it('tells someone signed in as another person to sign out', async () => {
    auth = fakeAuth(ME);
    const f = await render();
    expect(el(f, 'accept')).toBeNull();
    await click(f, 'sign-out');
    expect(auth.signOut).toHaveBeenCalled();
  });

  it('shows the invalid state for a 404 and offers the archive when signed in', async () => {
    auth = fakeAuth(ME);
    const f = await render(404);
    expect(el(f, 'invalid')).not.toBeNull();
    await click(f, 'to-archive');
    expect(navigate).toHaveBeenCalledWith('/');
    expect(navigate).not.toHaveBeenCalledWith(expect.stringContaining('/login'));
  });

  it('turns invalid when the invitation expires during sign-up', async () => {
    auth.signUpPasskey.mockImplementation(rejectWith('INVITE_REQUIRED'));
    const f = await render();
    await type(f, 'name', 'Валя');
    el(f, 'passkey-sign-up')!.click();
    await new Promise((resolve) => setTimeout(resolve));
    TestBed.tick();
    flush(404);
    await f.whenStable();
    expect(el(f, 'invalid')).not.toBeNull();
  });

  it('explains INVITE_REQUIRED when the invitation still works', async () => {
    auth.signUpPasskey.mockImplementation(rejectWith('INVITE_REQUIRED'));
    const f = await render();
    await type(f, 'name', 'Валя');
    el(f, 'passkey-sign-up')!.click();
    await new Promise((resolve) => setTimeout(resolve));
    TestBed.tick();
    flush(INVITATION);
    await f.whenStable();
    expect(el(f, 'invalid')).toBeNull();
    expect(el(f, 'error')).not.toBeNull();
  });

  it('waits for the session before choosing a state', async () => {
    auth.ready.set(false);
    const f = await render();
    expect(el(f, 'name')).toBeNull();
    expect(el(f, 'accept')).toBeNull();
    expect(el(f, 'loading')).not.toBeNull();
    auth.ready.set(true);
    await f.whenStable();
    expect(el(f, 'name')).not.toBeNull();
  });

  it('sends a half-done password sign-up to sign in', async () => {
    auth.signUpPassword.mockImplementation(rejectWith('SIGNED_UP_SIGN_IN_FAILED'));
    const f = await render();
    await click(f, 'show-password');
    await type(f, 'name', 'Валя');
    await type(f, 'password', 'correct horse battery');
    await click(f, 'submit');
    await new Promise((resolve) => setTimeout(resolve));
    await f.whenStable();
    expect(el(f, 'account-ready')).not.toBeNull();
    expect(el(f, 'submit')).toBeNull();
    await click(f, 'sign-in');
    expect(navigate).toHaveBeenCalledWith(
      `/login?returnUrl=${encodeURIComponent(`/invite/${ID}`)}`,
    );
  });

  it('refuses a name longer than 64 characters', async () => {
    const f = await render();
    await type(f, 'name', 'я'.repeat(65));
    await click(f, 'passkey-sign-up');
    expect(auth.signUpPasskey).not.toHaveBeenCalled();
  });

  it('has no literal text in its template', () => {
    expect(literalText('../../libs/web/features/auth/src/feature/invite.page.html')).toBe('');
  });
});
