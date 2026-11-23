import { isFamilyRole } from '@swarm-keeper/permissions';
import type { BetterAuthOptions } from 'better-auth';
import { APIError, createAuthMiddleware } from 'better-auth/api';
import type { Database } from '../../database/index.js';
import { hasPassword, TWO_FACTOR_REQUIRED } from './require-permission.js';
import { twoFactorRequired } from './rules.js';

export const SINGLE_ROLE_REQUIRED = 'SINGLE_ROLE_REQUIRED';

/** Better Auth's family admin routes: the 2FA rule applies to owners and admins on each. */
const ADMIN_PATHS = new Set([
  '/organization/invite-member',
  '/organization/update-member-role',
  '/organization/remove-member',
  '/organization/cancel-invitation',
  '/organization/update',
  '/organization/delete',
]);

/** Routes that assign a role: it must be exactly one family role, never a list. */
const ROLE_PATHS = new Set(['/organization/invite-member', '/organization/update-member-role']);

type Body = Record<string, unknown>;

/** The family the request acts on: explicit, through the invitation, or the active one. */
async function targetFamily(db: Database, body: Body, activeFamilyId: string | null | undefined) {
  if (typeof body['organizationId'] === 'string') {
    return body['organizationId'];
  }
  if (typeof body['invitationId'] === 'string') {
    const invitation = await db
      .selectFrom('invitation')
      .select('organizationId')
      .where('id', '=', body['invitationId'])
      .executeTakeFirst();
    return invitation?.organizationId;
  }
  return activeFamilyId ?? undefined;
}

/** Resolves the caller's session the way any request would, bearer tokens included. */
export type SessionLookup = (headers: Headers) => Promise<{
  session: { activeOrganizationId?: string | null };
  user: { id: string; twoFactorEnabled?: boolean | null };
} | null>;

/**
 * Before Better Auth handles a family admin route. The organization plugin still checks
 * the role matrix and `creatorRole` (only an owner grants the owner role); this adds our rules.
 *
 * The session comes from `lookupSession` (auth.api.getSession), not from the hook context:
 * user hooks run before plugin hooks and never see the headers bearer() rewrites, so a mobile
 * client's `Authorization: Bearer` would look anonymous here.
 */
export function organizationHooks(db: Database, lookupSession: SessionLookup) {
  return createAuthMiddleware(async (ctx) => {
    if (!ADMIN_PATHS.has(ctx.path)) {
      return;
    }
    const body = (ctx.body ?? {}) as Body;

    if (ROLE_PATHS.has(ctx.path) && !isFamilyRole(body['role'])) {
      throw new APIError('BAD_REQUEST', {
        code: SINGLE_ROLE_REQUIRED,
        message: SINGLE_ROLE_REQUIRED,
      });
    }

    const session = ctx.headers ? await lookupSession(ctx.headers) : null;
    if (!session) {
      return; // Better Auth answers 401 itself
    }
    const familyId = await targetFamily(db, body, session.session.activeOrganizationId);
    if (!familyId) {
      return;
    }
    const member = await db
      .selectFrom('member')
      .select('role')
      .where('userId', '=', session.user.id)
      .where('organizationId', '=', familyId)
      .executeTakeFirst();
    const actsAsAdmin = member?.role === 'owner' || member?.role === 'admin';
    if (
      actsAsAdmin &&
      twoFactorRequired(
        {
          twoFactorEnabled:
            (session.user as { twoFactorEnabled?: boolean | null }).twoFactorEnabled ?? null,
        },
        await hasPassword(db, session.user.id),
      )
    ) {
      throw new APIError('FORBIDDEN', { code: TWO_FACTOR_REQUIRED, message: TWO_FACTOR_REQUIRED });
    }
  });
}

/** A new session starts in the user's first family (by join date) when none is chosen. */
export function activeFamilyHooks(db: Database): NonNullable<BetterAuthOptions['databaseHooks']> {
  return {
    session: {
      create: {
        before: async (session) => {
          if (session['activeOrganizationId']) {
            return;
          }
          const first = await db
            .selectFrom('member')
            .select('organizationId')
            .where('userId', '=', session.userId)
            .orderBy('createdAt')
            .limit(1)
            .executeTakeFirst();
          if (!first) {
            return;
          }
          return { data: { ...session, activeOrganizationId: first.organizationId } };
        },
      },
    },
  };
}
