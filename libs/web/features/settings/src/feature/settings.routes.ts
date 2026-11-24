import type { Routes } from '@angular/router';
import { provideTranslocoScope } from '@jsverse/transloco';

/** `/settings/*`, a child of the signed-in shell (which holds authGuard). */
export const SETTINGS_ROUTES: Routes = [
  {
    path: 'security',
    providers: [provideTranslocoScope('settings')],
    loadComponent: () => import('./security.page').then((m) => m.SecurityPage),
  },
];
