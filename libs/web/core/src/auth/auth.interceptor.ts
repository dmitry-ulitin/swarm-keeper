import { HttpErrorResponse, type HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router } from '@angular/router';
import { TranslocoService } from '@jsverse/transloco';
import { catchError, throwError } from 'rxjs';

/**
 * 401 → /login (remembering the page), 403 TWO_FACTOR_REQUIRED → 2FA setup, any other 403 →
 * a plain "not allowed" message. The error always reaches the caller too.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  const snackBar = inject(MatSnackBar);
  const transloco = inject(TranslocoService, { optional: true });
  return next(req).pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse && req.url.startsWith('/api/v1/')) {
        const code = (error.error as { code?: string } | null)?.code;
        if (error.status === 401 && !req.url.startsWith('/api/v1/me')) {
          void router.navigateByUrl(`/login?returnUrl=${encodeURIComponent(router.url)}`);
        } else if (error.status === 403 && code === 'TWO_FACTOR_REQUIRED') {
          void router.navigateByUrl('/settings/security');
        } else if (error.status === 403) {
          snackBar.open(transloco?.translate('errors.forbidden') ?? 'errors.forbidden', undefined, {
            duration: 6000,
          });
        }
      }
      return throwError(() => error);
    }),
  );
};
