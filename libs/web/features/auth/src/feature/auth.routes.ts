import type { Routes } from '@angular/router';
import { provideTranslocoScope } from '@jsverse/transloco';
import { authGuard, guestGuard } from '@swarm-keeper/web-core';

const scope = [provideTranslocoScope('auth')];

/** Sign-in, invitation and password reset, plus the signed-in placeholder at `/`. */
export const AUTH_ROUTES: Routes = [
  {
    path: 'login',
    canMatch: [guestGuard],
    providers: scope,
    loadComponent: () => import('./login.page').then((m) => m.LoginPage),
  },
  {
    path: 'reset-password',
    canMatch: [guestGuard],
    providers: scope,
    loadComponent: () => import('./reset-password.page').then((m) => m.ResetPasswordPage),
  },
  {
    path: '',
    pathMatch: 'full',
    canMatch: [authGuard],
    providers: scope,
    loadComponent: () => import('./home-placeholder.page').then((m) => m.HomePlaceholderPage),
  },
];
