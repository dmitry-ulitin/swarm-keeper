import { Controller, Get, Inject } from '@nestjs/common';
import { type FamilyRole, isFamilyRole } from '@swarm-keeper/permissions';
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';
import { DATABASE, type Database } from '../../database/index.js';
import { hasPassword } from './require-permission.js';
import { permissionsOf, twoFactorRequired } from './rules.js';

export interface MeResponse {
  user: {
    id: string;
    name: string;
    email: string;
    locale: string;
    uiSize: string;
    twoFactorEnabled: boolean | null;
  };
  families: { id: string; name: string; role: string }[];
  activeFamilyId: string | null;
  role: FamilyRole | null;
  permissions: string[];
  twoFactorRequired: boolean;
}

/**
 * Who the caller is and what they may do in the active family. The UI hides actions with
 * `permissions`; the server checks every action again.
 */
@Controller('me')
export class MeController {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  @Get()
  async me(@Session() session: UserSession): Promise<MeResponse> {
    const userId = session.user.id;
    const user = await this.db
      .selectFrom('user')
      .select(['id', 'name', 'email', 'locale', 'uiSize', 'twoFactorEnabled'])
      .where('id', '=', userId)
      .executeTakeFirstOrThrow();
    const families = await this.db
      .selectFrom('member')
      .innerJoin('organization', 'organization.id', 'member.organizationId')
      .select(['organization.id', 'organization.name', 'member.role'])
      .where('member.userId', '=', userId)
      .orderBy('member.createdAt')
      .execute();

    const sessionFamilyId = (session.session as { activeOrganizationId?: string | null })
      .activeOrganizationId;
    // A family the user is not (or no longer) in is not their active family.
    const active = families.find((family) => family.id === sessionFamilyId);
    const activeFamilyId = active?.id ?? null;
    const activeRole = active?.role;
    const role = isFamilyRole(activeRole) ? activeRole : null;
    const isAdmin = role === 'owner' || role === 'admin';

    return {
      user,
      families,
      activeFamilyId,
      role,
      permissions: role ? permissionsOf(role) : [],
      twoFactorRequired: isAdmin && twoFactorRequired(user, await hasPassword(this.db, userId)),
    };
  }
}
