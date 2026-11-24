import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, UrlTree, provideRouter } from '@angular/router';
import { describe, expect, it } from 'vitest';
import { AUTH_CLIENT } from './auth-client';
import { ME, fakeClient } from './testing';
import { authGuard, guestGuard } from './guards';

function setup() {
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      provideRouter([]),
      { provide: AUTH_CLIENT, useValue: fakeClient() },
    ],
  });
  return TestBed.inject(HttpTestingController);
}

async function run(guard: typeof authGuard, url: string, me: object | 401) {
  const http = setup();
  const result = TestBed.runInInjectionContext(() =>
    guard(
      { path: url.slice(1) },
      url
        .slice(1)
        .split('/')
        .map((path) => ({ path }) as never),
      {} as never,
    ),
  );
  await Promise.resolve();
  const req = http.expectOne('/api/v1/me');
  if (me === 401) req.flush({}, { status: 401, statusText: 'Unauthorized' });
  else req.flush(me);
  return (await result) as boolean | UrlTree;
}

describe('guards', () => {
  it('sends a signed-out visitor to /login with the return url', async () => {
    const result = await run(authGuard, '/', 401);
    expect(TestBed.inject(Router).serializeUrl(result as UrlTree)).toBe('/login?returnUrl=%2F');
  });

  it('lets a signed-in user through authGuard', async () => {
    expect(await run(authGuard, '/', ME)).toBe(true);
  });

  it('sends a signed-in user away from /login', async () => {
    const result = await run(guestGuard, '/login', ME);
    expect(TestBed.inject(Router).serializeUrl(result as UrlTree)).toBe('/');
  });

  describe('guestGuard with a return url', () => {
    @Component({ template: '' })
    class Blank {}

    async function navigate(url: string) {
      TestBed.configureTestingModule({
        providers: [
          provideHttpClient(),
          provideHttpClientTesting(),
          provideRouter([
            { path: 'login', canMatch: [guestGuard], component: Blank },
            { path: 'settings/security', component: Blank },
            { path: '', component: Blank },
          ]),
          { provide: AUTH_CLIENT, useValue: fakeClient() },
        ],
      });
      const http = TestBed.inject(HttpTestingController);
      const router = TestBed.inject(Router);
      const done = router.navigateByUrl(url);
      await new Promise((resolve) => setTimeout(resolve));
      http.expectOne('/api/v1/me').flush(ME);
      await done;
      return router.url;
    }

    it('sends a signed-in user to the safe return url', async () => {
      expect(await navigate('/login?returnUrl=%2Fsettings%2Fsecurity')).toBe('/settings/security');
    });

    it('ignores an off-site return url', async () => {
      expect(await navigate('/login?returnUrl=%2F%2Fevil.example')).toBe('/');
    });
  });
});
