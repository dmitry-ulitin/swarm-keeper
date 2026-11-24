import { isDevMode } from '@angular/core';
import { Routes } from '@angular/router';
import { AUTH_ROUTES, HOME_ROUTES } from '@swarm-keeper/feature-auth';
import { authGuard } from '@swarm-keeper/web-core';
import { DEV_ROUTES } from './dev/dev-routes';

/** The app's routes; `dev` adds the development-only pages. */
export function appRoutes(dev: boolean): Routes {
  return [
    ...(dev ? DEV_ROUTES : []),
    ...AUTH_ROUTES,
    // Every signed-in screen sits in the shell (header and user menu).
    {
      path: '',
      loadComponent: () => import('./shell/shell').then((m) => m.Shell),
      canMatch: [authGuard],
      children: [
        ...HOME_ROUTES,
        {
          path: 'settings',
          loadChildren: () =>
            import('@swarm-keeper/feature-settings').then((m) => m.SETTINGS_ROUTES),
        },
        {
          path: 'family',
          loadChildren: () => import('@swarm-keeper/feature-family').then((m) => m.FAMILY_ROUTES),
        },
      ],
    },
  ];
}

export const routes: Routes = appRoutes(isDevMode());
