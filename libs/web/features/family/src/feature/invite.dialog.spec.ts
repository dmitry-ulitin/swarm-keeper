import { TestBed } from '@angular/core/testing';
import { MatDialogRef } from '@angular/material/dialog';
import { provideTranslocoScope } from '@jsverse/transloco';
import { AppearanceService, AuthError, AuthService, provideWebCore } from '@swarm-keeper/web-core';
import { describe, expect, it, vi } from 'vitest';
import { InviteDialog } from './invite.dialog';
import { FEATURE, ME, errorText, fakeAuth, fileLoader, literalText } from './testing';

async function render(auth = fakeAuth()) {
  const close = vi.fn();
  TestBed.configureTestingModule({
    providers: [
      provideWebCore(),
      fileLoader,
      provideTranslocoScope('family'),
      { provide: AuthService, useValue: auth },
      { provide: MatDialogRef, useValue: { close } },
    ],
  });
  TestBed.inject(AppearanceService).setLang('ru');
  const fixture = TestBed.createComponent(InviteDialog);
  await fixture.whenStable();
  const el = fixture.nativeElement as HTMLElement;
  const dialog = fixture.componentInstance as unknown as {
    roles: () => string[];
    model: () => { email: string; role: string; locale: string };
  };
  return { auth, close, fixture, el, dialog };
}

describe('InviteDialog', () => {
  it('offers no Owner role to an admin', async () => {
    const { dialog } = await render(fakeAuth({ ...ME, role: 'admin' }));
    expect(dialog.roles()).toEqual(['admin', 'member', 'viewer']);
  });

  it('offers Owner to an owner', async () => {
    const { dialog } = await render();
    expect(dialog.roles()).toContain('owner');
  });

  it('defaults to the member role and the inviter language', async () => {
    const { dialog } = await render(fakeAuth({ ...ME, user: { ...ME.user, locale: 'en' } }));
    expect(dialog.model()).toEqual({ email: '', role: 'member', locale: 'en' });
  });

  it('keeps the dialog open with the error when the person is already invited', async () => {
    const auth = fakeAuth();
    auth.invite.mockImplementation(() =>
      Promise.reject(new AuthError('USER_IS_ALREADY_INVITED_TO_THIS_ORGANIZATION')),
    );
    const { el, fixture, close } = await render(auth);
    const input = el.querySelector('[data-test="email"]') as HTMLInputElement;
    input.value = 'bob@example.test';
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    (el.querySelector('[data-test="send"]') as HTMLElement).click();
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve));
    await fixture.whenStable();
    expect(auth.invite).toHaveBeenCalledWith({
      email: 'bob@example.test',
      role: 'member',
      locale: 'ru',
    });
    expect(el.querySelector('[data-test="error"]')?.textContent).toContain(
      errorText('ru')['USER_IS_ALREADY_INVITED_TO_THIS_ORGANIZATION'],
    );
    expect(close).not.toHaveBeenCalled();
  });

  it('has no literal text in its template', () => {
    expect(literalText(`${FEATURE}/invite.dialog.html`)).toBe('');
  });
});
