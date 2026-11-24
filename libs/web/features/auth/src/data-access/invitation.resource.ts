import { httpResource } from '@angular/common/http';
import type { Signal } from '@angular/core';

/** `GET /api/v1/invitations/:id`: what the invitation page shows before anyone signs in. */
export interface InvitationView {
  email: string;
  familyName: string;
  inviterName: string;
  role: string;
  locale: 'en' | 'ru';
  expiresAt: string;
  hasAccount: boolean;
}

/** The invitation behind a link; a 404 (unknown, expired or used) is the resource's error. */
export function invitationResource(id: Signal<string>) {
  return httpResource<InvitationView>(() => `/api/v1/invitations/${encodeURIComponent(id())}`);
}
