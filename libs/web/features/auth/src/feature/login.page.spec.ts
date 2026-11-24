import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { provideTranslocoScope } from '@jsverse/transloco';
import { AppearanceService, AuthService, provideWebCore } from '@swarm-keeper/web-core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { authText, fakeAuth, fileLoader, literalText, rejectWith, rootText } from './testing';
import { LoginPage } from './login.page';

describe('LoginPage', () => {
  let auth: ReturnType<typeof fakeAuth>;
  let navigate: ReturnType<typeof vi.fn>;

  async function render(query: Record<string, string> = {}) {
    TestBed.configureTestingModule({
      providers: [
        provideWebCore(),
        provideRouter([]),
        fileLoader,
        provideTranslocoScope('auth'),
        { provide: AuthService, useValue: auth },
      ],
    });
    navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true) as never;
    const fixture = TestBed.createComponent(LoginPage);
    for (const [key, value] of Object.entries(query)) fixture.componentRef.setInput(key, value);
    await fixture.whenStable();
    return fixture;
  }

  const el = (f: { nativeElement: HTMLElement }, hook: string) =>
    f.nativeElement.querySelector(`[data-test="${hook}"]`) as HTMLElement | null;

  async function type(
    f: { nativeElement: HTMLElement; whenStable(): Promise<unknown> },
    hook: string,
    value: string,
  ) {
    const input = el(f, hook) as HTMLInputElement;
    input.value = value;
    input.dispatchEvent(new Event('input'));
    await f.whenStable();
  }

  beforeEach(() => {
    TestBed.resetTestingModule();
    auth = fakeAuth();
  });

  it('starts with the passkey and hides the password form', async () => {
    const f = await render();
    expect(el(f, 'passkey')).not.toBeNull();
    expect(el(f, 'password')).toBeNull();
    el(f, 'show-password')!.click();
    await f.whenStable();
    expect(el(f, 'email')).not.toBeNull();
    expect(el(f, 'password')).not.toBeNull();
  });

  it('signs in with a passkey and goes to the return url', async () => {
    const f = await render({ returnUrl: '/invite/x' });
    el(f, 'passkey')!.click();
    await f.whenStable();
    expect(auth.signInPasskey).toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith('/invite/x');
  });

  it('asks for the second factor and then follows the return url', async () => {
    auth.signInPassword.mockResolvedValue('two-factor');
    const f = await render({ returnUrl: '/invite/x' });
    el(f, 'show-password')!.click();
    await f.whenStable();
    await type(f, 'email', 'anna@example.test');
    await type(f, 'password', 'correct horse battery');
    el(f, 'submit')!.click();
    await f.whenStable();
    expect(auth.signInPassword).toHaveBeenCalledWith('anna@example.test', 'correct horse battery');
    expect(el(f, 'code')).not.toBeNull();
    await type(f, 'code', '123456');
    el(f, 'submit')!.click();
    await f.whenStable();
    expect(auth.verifyTotp).toHaveBeenCalledWith('123456');
    expect(navigate).toHaveBeenCalledWith('/invite/x');
  });

  it('never follows a return url to another site', async () => {
    const f = await render({ returnUrl: '//evil.example' });
    el(f, 'passkey')!.click();
    await f.whenStable();
    expect(navigate).toHaveBeenCalledWith('/');
  });

  it('shows the translated error', async () => {
    auth.signInPassword.mockImplementation(rejectWith('INVALID_EMAIL_OR_PASSWORD'));
    const f = await render();
    TestBed.inject(AppearanceService).setLang('ru');
    el(f, 'show-password')!.click();
    await f.whenStable();
    await type(f, 'email', 'anna@example.test');
    await type(f, 'password', 'wrong password here');
    el(f, 'submit')!.click();
    await f.whenStable();
    expect(el(f, 'error')?.textContent?.trim()).toBe(
      rootText('ru').auth['INVALID_EMAIL_OR_PASSWORD'],
    );
  });

  it('shows the same note after a reset request, even when it fails', async () => {
    auth.requestPasswordReset.mockImplementation(rejectWith('UNKNOWN'));
    const f = await render();
    el(f, 'show-password')!.click();
    await f.whenStable();
    el(f, 'forgot')!.click();
    await f.whenStable();
    await type(f, 'email', 'someone@example.test');
    el(f, 'submit')!.click();
    await f.whenStable();
    expect(auth.requestPasswordReset).toHaveBeenCalledWith('someone@example.test');
    expect(el(f, 'forgot-sent')?.textContent?.trim()).toBe(authText('en')['forgot']!['sent']);
  });

  it('has no literal text in its template', () => {
    expect(literalText('../../libs/web/features/auth/src/feature/login.page.html')).toBe('');
  });
});
