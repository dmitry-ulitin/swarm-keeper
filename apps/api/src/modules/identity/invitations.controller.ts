import { Controller, Get, Inject, NotFoundException, Param } from '@nestjs/common';
import { AllowAnonymous } from '@thallesp/nestjs-better-auth';
import { DATABASE, type Database } from '../../database/index.js';
import { findPendingInvitationById } from './invite-only.js';

export const INVITATION_NOT_FOUND = 'INVITATION_NOT_FOUND';

export interface InvitationView {
  email: string;
  familyName: string;
  inviterName: string;
  role: string;
  locale: 'en' | 'ru';
  expiresAt: string;
  hasAccount: boolean;
}

/** `ru` or `ru-*` → `ru`, anything else → `en`. */
export function normalizeLocale(value: unknown): 'en' | 'ru' {
  return typeof value === 'string' && value.toLowerCase().split(/[-_]/)[0] === 'ru' ? 'ru' : 'en';
}

/**
 * What the invitation page needs before anyone is signed in. The id is the secret from the
 * email, so this shows only what the email already said; every other case is one 404.
 */
@Controller('invitations')
export class InvitationsController {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  @Get(':id')
  @AllowAnonymous()
  async show(@Param('id') id: string): Promise<InvitationView> {
    const invitation = await findPendingInvitationById(this.db, id);
    if (!invitation) {
      throw new NotFoundException({ code: INVITATION_NOT_FOUND, params: {} });
    }
    const family = await this.db
      .selectFrom('organization')
      .select('name')
      .where('id', '=', invitation.organizationId)
      .executeTakeFirstOrThrow();
    const inviter = await this.db
      .selectFrom('user')
      .select('name')
      .where('id', '=', invitation.inviterId)
      .executeTakeFirst();
    const account = await this.db
      .selectFrom('user')
      .select('id')
      .where((eb) => eb(eb.fn('lower', ['email']), '=', invitation.email.toLowerCase()))
      .executeTakeFirst();
    return {
      email: invitation.email,
      familyName: family.name,
      inviterName: inviter?.name ?? '',
      role: invitation.role ?? 'member',
      locale: normalizeLocale(invitation.locale),
      expiresAt: new Date(invitation.expiresAt).toISOString(),
      hasAccount: account !== undefined,
    };
  }
}
