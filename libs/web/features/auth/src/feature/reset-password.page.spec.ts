import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { provideTranslocoScope } from '@jsverse/transloco';
import { AuthService, provideWebCore } from '@swarm-keeper/web-core';
import { describe, expect, it, vi } from 'vitest';
import { fakeAuth, fileLoader, literalText } from './testing';
import { ResetPasswordPage } from './reset-password.page';

async function render(token: string | undefined) {
  const auth = fakeAuth();
  TestBed.configureTestingModule({
    providers: [
      provideWebCore(),
      provideRouter([]),
      fileLoader,
      provideTranslocoScope('auth'),
      { provide: AuthService, useValue: auth },
    ],
  });
  const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
  const fixture = TestBed.createComponent(ResetPasswordPage);
  if (token) fixture.componentRef.setInput('token', token);
  await fixture.whenStable();
  return { fixture, auth, navigate };
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

describe('ResetPasswordPage', () => {
  it('does not submit mismatched passwords', async () => {
    const { fixture, auth } = await render('tok');
    await type(fixture, 'password', 'correct horse battery');
    await type(fixture, 'repeat', 'correct horse batterY');
    el(fixture, 'submit')!.click();
    await fixture.whenStable();
    expect(auth.resetPassword).not.toHaveBeenCalled();
  });

  it('saves the password and goes to /login?reset=1', async () => {
    const { fixture, auth, navigate } = await render('tok');
    await type(fixture, 'password', 'correct horse battery');
    await type(fixture, 'repeat', 'correct horse battery');
    el(fixture, 'submit')!.click();
    await fixture.whenStable();
    expect(auth.resetPassword).toHaveBeenCalledWith('tok', 'correct horse battery');
    expect(navigate).toHaveBeenCalledWith('/login?reset=1');
  });

  it('explains a missing token', async () => {
    const { fixture } = await render(undefined);
    expect(el(fixture, 'error')).not.toBeNull();
    expect(el(fixture, 'password')).toBeNull();
  });

  it('has no literal text in its template', () => {
    expect(literalText('../../libs/web/features/auth/src/feature/reset-password.page.html')).toBe(
      '',
    );
  });
});
