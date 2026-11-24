import type { Routes } from '@angular/router';
import { provideTranslocoScope } from '@jsverse/transloco';
import { familyGuard, permissionGuard } from '@swarm-keeper/web-core';

/** `/family/*`, a child of the signed-in shell (which holds authGuard). */
export const FAMILY_ROUTES: Routes = [
  {
    path: 'members',
    canMatch: [familyGuard, permissionGuard('member', 'create')],
    providers: [provideTranslocoScope('family')],
    loadComponent: () => import('./members.page').then((m) => m.MembersPage),
  },
];
