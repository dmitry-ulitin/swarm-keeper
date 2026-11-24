import { inject } from '@angular/core';
import { type CanMatchFn, Router, type UrlSegment } from '@angular/router';
import { AuthService } from './auth.service';
import { safeReturnUrl } from './return-url';

const urlOf = (segments: UrlSegment[]) => '/' + segments.map((s) => s.path).join('/');

/** A session exists; otherwise /login, remembering where the visitor was heading. */
export const authGuard: CanMatchFn = async (_route, segments) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  await auth.ensureLoaded();
  if (auth.signedIn()) return true;
  return router.createUrlTree(['/login'], { queryParams: { returnUrl: urlOf(segments) } });
};

/** No session: pages for visitors (sign-in, password reset). */
export const guestGuard: CanMatchFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const returnUrl = router.currentNavigation()?.extractedUrl.queryParamMap.get('returnUrl');
  await auth.ensureLoaded();
  return auth.signedIn() ? router.parseUrl(safeReturnUrl(returnUrl)) : true;
};

/** An active family is selected. */
export const familyGuard: CanMatchFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  await auth.ensureLoaded();
  return auth.activeFamily() ? true : router.createUrlTree(['/']);
};

/** The member may do `action` on `resource` in the active family. */
export const permissionGuard =
  (resource: string, action: string): CanMatchFn =>
  async () => {
    const auth = inject(AuthService);
    const router = inject(Router);
    await auth.ensureLoaded();
    return auth.permissions().includes(`${resource}:${action}`)
      ? true
      : router.createUrlTree(['/']);
  };
