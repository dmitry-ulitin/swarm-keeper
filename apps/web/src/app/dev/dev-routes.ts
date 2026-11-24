import { Routes } from '@angular/router';
import { provideTranslocoScope } from '@jsverse/transloco';

/** Development-only pages. The production build swaps this file for dev-routes.prod.ts. */
export const DEV_ROUTES: Routes = [
  {
    path: 'dev/foundations',
    loadComponent: () => import('./foundations').then((m) => m.Foundations),
    providers: [provideTranslocoScope('dev')],
  },
];
