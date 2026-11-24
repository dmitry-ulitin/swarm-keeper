import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { provideRouter } from '@angular/router';
import { provideTranslocoScope } from '@jsverse/transloco';
import { AppearanceService, AuthService, provideWebCore } from '@swarm-keeper/web-core';
import { provideIcons } from '@swarm-keeper/web-ui';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { InviteDialog } from './invite.dialog';
import { MembersPage } from './members.page';
import { FEATURE, ME, familyText, fakeAuth, fileLoader, literalText } from './testing';

async function render(auth = fakeAuth()) {
  const open = vi.fn(() => ({ afterClosed: () => of(true) }));
  const snack = vi.fn();
  TestBed.configureTestingModule({
    providers: [
      provideWebCore(),
      provideRouter([]),
      provideIcons(),
      fileLoader,
      provideTranslocoScope('family'),
      { provide: AuthService, useValue: auth },
      { provide: MatDialog, useValue: { open } },
      { provide: MatSnackBar, useValue: { open: snack } },
    ],
  });
  TestBed.inject(AppearanceService).setLang('ru');
  const fixture = TestBed.createComponent(MembersPage);
  await fixture.whenStable();
  await new Promise((resolve) => setTimeout(resolve));
  await fixture.whenStable();
  const el = fixture.nativeElement as HTMLElement;
  const click = async (target: Element | null) => {
    (target as HTMLElement).click();
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve));
    await fixture.whenStable();
  };
  return { auth, open, snack, fixture, el, click };
}

const text = familyText('ru');

describe('MembersPage', () => {
  it('names the family and lists members and pending invitations only', async () => {
    const { el } = await render();
    expect(el.querySelector('[data-test="title"]')?.textContent).toContain('Ивановы');
    expect(el.querySelectorAll('[data-test="member"]')).toHaveLength(2);
    expect(el.querySelectorAll('[data-test="invitation"]')).toHaveLength(2);
  });

  it('gives the owner no menu on their own row, and one on Anna', async () => {
    const { el } = await render();
    const [self, anna] = Array.from(el.querySelectorAll('[data-test="member"]'));
    expect(self?.querySelector('[data-test="member-menu"]')).toBeNull();
    expect(anna?.querySelector('[data-test="member-menu"]')).not.toBeNull();
  });

  it('marks the expired invitation', async () => {
    const { el } = await render();
    const rows = Array.from(el.querySelectorAll('[data-test="invitation"]'));
    const late = rows.find((row) => row.textContent?.includes('late@example.test'));
    expect(late?.querySelector('[data-test="expired"]')?.textContent).toContain(
      text.invitations['expired'],
    );
  });

  it('says "not implemented" for Change role', async () => {
    const { el, snack, click } = await render();
    const anna = el.querySelectorAll('[data-test="member"]')[1]!;
    await click(anna.querySelector('[data-test="member-menu"]'));
    await click(document.querySelector('[data-test="change-role"]'));
    expect(snack).toHaveBeenCalledWith(text.notImplemented, undefined, expect.anything());
  });

  it('replaces the actions with a 2FA note when 2FA is required', async () => {
    const { el } = await render(fakeAuth({ ...ME, twoFactorRequired: true }));
    expect(el.querySelector('[data-test="two-factor-note"]')).not.toBeNull();
    expect(el.querySelector('[data-test="invite"]')).toBeNull();
    expect(el.querySelector('[data-test="resend"]')).toBeNull();
    expect(el.querySelector('[data-test="cancel"]')).toBeNull();
  });

  it('opens the invite dialog', async () => {
    const { el, open, click } = await render();
    await click(el.querySelector('[data-test="invite"]'));
    expect(open).toHaveBeenCalledWith(InviteDialog, expect.anything());
  });

  it('resends an expired invitation even when the old one stays, and reloads', async () => {
    const auth = fakeAuth();
    const { el, snack, click } = await render(auth);
    const rows = Array.from(el.querySelectorAll('[data-test="invitation"]'));
    const late = rows.find((row) => row.textContent?.includes('late@example.test'))!;
    auth.listInvitations.mockClear();
    await click(late.querySelector('[data-test="resend"]'));
    expect(auth.resendInvitation).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'i-expired' }),
    );
    expect(snack).toHaveBeenCalledWith(text.invitations['resent'], undefined, expect.anything());
    expect(auth.listInvitations).toHaveBeenCalled();
  });

  it('cancels an invitation after a confirm', async () => {
    const auth = fakeAuth();
    const { el, click } = await render(auth);
    await click(el.querySelector('[data-test="invitation"] [data-test="cancel"]'));
    expect(auth.cancelInvitation).toHaveBeenCalledWith('i-valid');
  });

  it('shows an error with a retry when the lists fail to load', async () => {
    const auth = fakeAuth();
    auth.listMembers.mockImplementation(() => Promise.reject(new Error('down')));
    auth.listInvitations.mockImplementation(() => Promise.reject(new Error('down')));
    const { el, click } = await render(auth);
    expect(el.querySelector('[data-test="members-error"]')).not.toBeNull();
    expect(el.querySelector('[data-test="invitations-error"]')).not.toBeNull();
    auth.listMembers.mockClear();
    await click(el.querySelector('[data-test="members-error"] button'));
    expect(auth.listMembers).toHaveBeenCalled();
  });

  it('has no literal text in its template', () => {
    expect(literalText(`${FEATURE}/members.page.html`)).toBe('');
  });
});
