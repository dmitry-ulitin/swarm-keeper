import { readFileSync } from 'node:fs';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { AuthService, type MeResponse, provideWebCore } from '@swarm-keeper/web-core';
import { provideIcons } from '@swarm-keeper/web-ui';
import { describe, expect, it, vi } from 'vitest';
import { Shell } from './shell';

const ME: MeResponse = {
  user: {
    id: 'u1',
    name: 'Дмитрий',
    email: 'owner@example.test',
    locale: 'ru',
    uiSize: 'compact',
    twoFactorEnabled: true,
    hasPassword: true,
  },
  families: [{ id: 'f1', name: 'Ивановы', role: 'owner' }],
  activeFamilyId: 'f1',
  role: 'owner',
  permissions: ['member:create'],
  twoFactorRequired: false,
};

function fakeAuth(me: MeResponse) {
  const state = signal<MeResponse | null>(me);
  return {
    user: () => state()?.user ?? null,
    permissions: () => state()?.permissions ?? [],
    signOut: vi.fn(async () => undefined),
  };
}

async function render(me: MeResponse) {
  const auth = fakeAuth(me);
  TestBed.configureTestingModule({
    providers: [
      provideWebCore(),
      provideRouter([]),
      provideIcons(),
      { provide: AuthService, useValue: auth },
    ],
  });
  const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
  const fixture = TestBed.createComponent(Shell);
  await fixture.whenStable();
  (fixture.nativeElement.querySelector('[data-test="user-menu"]') as HTMLElement).click();
  await fixture.whenStable();
  return { auth, navigate, fixture, menu: () => document.querySelector('.mat-mdc-menu-panel') };
}

describe('Shell', () => {
  it('shows the initial and opens a menu with the name and email', async () => {
    const { fixture, menu } = await render(ME);
    expect(fixture.nativeElement.querySelector('[data-test="user-menu"]')?.textContent).toContain(
      'Д',
    );
    expect(menu()?.textContent).toContain('Дмитрий');
    expect(menu()?.textContent).toContain('owner@example.test');
  });

  it('offers Members to an owner', async () => {
    const { menu } = await render(ME);
    expect(menu()?.querySelector('[data-test="menu-security"]')).not.toBeNull();
    expect(menu()?.querySelector('[data-test="menu-members"]')).not.toBeNull();
    expect(menu()?.querySelector('[data-test="sign-out"]')).not.toBeNull();
  });

  it('hides Members from a member', async () => {
    const { menu } = await render({ ...ME, role: 'member', permissions: ['asset:create'] });
    expect(menu()?.querySelector('[data-test="menu-security"]')).not.toBeNull();
    expect(menu()?.querySelector('[data-test="menu-members"]')).toBeNull();
  });

  it('signs out and goes to /login', async () => {
    const { auth, navigate, fixture, menu } = await render(ME);
    (menu()?.querySelector('[data-test="sign-out"]') as HTMLElement).click();
    await fixture.whenStable();
    expect(auth.signOut).toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith('/login');
  });

  it('has no literal text in its template', () => {
    const text = readFileSync('src/app/shell/shell.html', 'utf8')
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/\{\{[\s\S]*?\}\}/g, '')
      .replace(/<[^>]*>/g, '')
      .replace(/@[a-z]+\s*(\((?:[^()]|\([^()]*\))*\))?\s*\{/gi, '')
      .replace(/[{}]/g, '')
      .trim();
    expect(text).toBe('');
  });
});
