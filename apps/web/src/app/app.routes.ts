import { isDevMode } from '@angular/core';
import { Routes } from '@angular/router';
import { AUTH_ROUTES, HOME_ROUTES } from '@swarm-keeper/feature-auth';
import { authGuard } from '@swarm-keeper/web-core';
import { DEV_ROUTES } from './dev/dev-routes';
import { Shell } from './shell/shell';

/** The app's routes; `dev` adds the development-only pages. */
export function appRoutes(dev: boolean): Routes {
  return [
    ...(dev ? DEV_ROUTES : []),
    ...AUTH_ROUTES,
    // Every signed-in screen sits in the shell (header and user menu).
    { path: '', component: Shell, canMatch: [authGuard], children: [...HOME_ROUTES] },
  ];
}

export const routes: Routes = appRoutes(isDevMode());
