import { isDevMode } from '@angular/core';
import { Routes } from '@angular/router';
import { DEV_ROUTES } from './dev/dev-routes';

/** The app's routes; `dev` adds the development-only pages. */
export function appRoutes(dev: boolean): Routes {
  return dev ? [...DEV_ROUTES] : [];
}

export const routes: Routes = appRoutes(isDevMode());
