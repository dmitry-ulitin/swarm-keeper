import { TestBed } from '@angular/core/testing';
import { MatDialogRef } from '@angular/material/dialog';
import { provideTranslocoScope } from '@jsverse/transloco';
import { AuthService, provideWebCore } from '@swarm-keeper/web-core';
import { provideIcons } from '@swarm-keeper/web-ui';
import { describe, expect, it, vi } from 'vitest';
import { FEATURE, fakeAuth, fileLoader, literalText, rejectWith } from './testing';
import { TwoFactorDialog } from './two-factor.dialog';

async function render(auth = fakeAuth()) {
  const close = vi.fn();
  TestBed.configureTestingModule({
    providers: [
      provideWebCore(),
      provideIcons(),
      fileLoader,
      provideTranslocoScope('settings'),
      { provide: AuthService, useValue: auth },
      { provide: MatDialogRef, useValue: { close } },
    ],
  });
  const fixture = TestBed.createComponent(TwoFactorDialog);
  await fixture.whenStable();
  const el = fixture.nativeElement as HTMLElement;
  const type = async (selector: string, value: string) => {
    const input = el.querySelector(selector) as HTMLInputElement;
    input.value = value;
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();
  };
  const click = async (selector: string) => {
    (el.querySelector(selector) as HTMLElement).click();
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve));
    await fixture.whenStable();
  };
  return { auth, close, fixture, el, type, click };
}

describe('TwoFactorDialog', () => {
  it('goes from the password to the scan step and groups the secret by four', async () => {
    const { auth, el, type, click } = await render();
    await type('[data-test="password"]', 'secret password');
    await click('[data-test="next"]');
    expect(auth.startTwoFactor).toHaveBeenCalledWith('secret password');
    expect(el.querySelector('[data-test="secret"]')?.textContent?.trim()).toBe(
      'JBSW Y3DP EHPK 3PXP',
    );
  });

  it('stays on the scan step with an error for a wrong code', async () => {
    const auth = fakeAuth();
    auth.confirmTwoFactor.mockImplementation(rejectWith('INVALID_CODE'));
    const { el, type, click } = await render(auth);
    await type('[data-test="password"]', 'secret password');
    await click('[data-test="next"]');
    await type('[data-test="code"]', '123456');
    await click('[data-test="confirm"]');
    expect(el.querySelector('[data-test="error"]')).not.toBeNull();
    expect(el.querySelector('[data-test="secret"]')).not.toBeNull();
  });

  it('shows the eight backup codes after the right code', async () => {
    const { el, type, click } = await render();
    await type('[data-test="password"]', 'secret password');
    await click('[data-test="next"]');
    await type('[data-test="code"]', '123456');
    await click('[data-test="confirm"]');
    expect(el.querySelectorAll('[data-test="backup-code"]')).toHaveLength(8);
  });

  it('forgets the secret and the codes when closed half-way', async () => {
    const { auth, fixture, type, click, close } = await render();
    await type('[data-test="password"]', 'secret password');
    await click('[data-test="next"]');
    await click('[data-test="cancel"]');
    expect(close).toHaveBeenCalled();
    expect(auth.confirmTwoFactor).not.toHaveBeenCalled();
    const dialog = fixture.componentInstance as unknown as {
      totpURI: () => string;
      codes: () => string[];
    };
    expect(dialog.totpURI()).toBe('');
    expect(dialog.codes()).toEqual([]);
  });

  it('has no literal text in its template', () => {
    expect(literalText(`${FEATURE}/two-factor.dialog.html`)).toBe('');
  });
});
