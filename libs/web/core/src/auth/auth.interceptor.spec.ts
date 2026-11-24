import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router, provideRouter } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { authInterceptor } from './auth.interceptor';

describe('authInterceptor', () => {
  let http: HttpTestingController;
  let navigate: ReturnType<typeof vi.fn>;
  let snack: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    navigate = vi.fn();
    snack = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: MatSnackBar, useValue: { open: snack } },
      ],
    });
    const router = TestBed.inject(Router);
    vi.spyOn(router, 'navigateByUrl').mockImplementation(navigate as never);
    Object.defineProperty(router, 'url', { get: () => '/current' });
    http = TestBed.inject(HttpTestingController);
  });

  async function call(url: string, status: number, body: object = {}) {
    const done = firstValueFrom(TestBed.inject(HttpClient).get(url)).catch((e: unknown) => e);
    http.expectOne(url).flush(body, { status, statusText: 'x' });
    return done;
  }

  it('sends a 401 to /login with the return url', async () => {
    await call('/api/v1/assets', 401);
    expect(navigate).toHaveBeenCalledWith('/login?returnUrl=%2Fcurrent');
  });

  it('leaves a 401 from /me alone', async () => {
    await call('/api/v1/me', 401);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('sends TWO_FACTOR_REQUIRED to /settings/security', async () => {
    await call('/api/v1/families/x', 403, { code: 'TWO_FACTOR_REQUIRED', params: {} });
    expect(navigate).toHaveBeenCalledWith('/settings/security');
  });

  it('explains any other 403', async () => {
    await call('/api/v1/assets', 403, { code: 'FORBIDDEN', params: {} });
    await vi.waitFor(() => expect(snack).toHaveBeenCalled());
    expect(navigate).not.toHaveBeenCalled();
  });

  it('passes the error on', async () => {
    const error = await call('/api/v1/assets', 500);
    expect((error as { status: number }).status).toBe(500);
  });
});
