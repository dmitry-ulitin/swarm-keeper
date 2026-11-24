import { getCurrentAdapter } from 'better-auth';
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

/** Resolves the caller's session the way any request would, bearer tokens included. */
export type SessionLookup = (headers: Headers) => Promise<{
  session: { activeOrganizationId?: string | null; createdAt?: Date | string };
  user: { id: string; twoFactorEnabled?: boolean | null };
} | null>;

/**
 * Before Better Auth handles a family admin route. The organization plugin still checks
 * the role matrix and `creatorRole` (only an owner grants the owner role); this adds our rules.
 * Someone who is a plain member everywhere is refused by Better Auth, never asked for 2FA.
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
    // Fail closed: the rule applies to anyone who is an owner or admin in any family, so it
    // never depends on guessing which family Better Auth will act on (body.organizationId,
    // the invitation's family or the active one; an empty or foreign id falls through there).
    const adminSomewhere = await db
      .selectFrom('member')
      .select('id')
      .where('userId', '=', session.user.id)
      .where('role', 'in', ['owner', 'admin'])
      .limit(1)
      .executeTakeFirst();
    if (
      adminSomewhere &&
      twoFactorRequired(
        { twoFactorEnabled: session.user.twoFactorEnabled ?? null },
        await hasPassword(db, session.user.id),
      )
    ) {
      throw new APIError('FORBIDDEN', { code: TWO_FACTOR_REQUIRED, message: TWO_FACTOR_REQUIRED });
    }
  });
}

/**
 * The user's first family by join date. Inside a Better Auth request it reads through the
 * current adapter, so it sees a membership written earlier in the same transaction (passkey
 * sign-up); elsewhere it uses our pool.
 */
async function firstFamilyId(
  db: Database,
  userId: string,
  ctx: unknown,
): Promise<string | undefined> {
  const adapter = (
    ctx as { context?: { adapter?: Parameters<typeof getCurrentAdapter>[0] } } | null
  )?.context?.adapter;
  if (adapter) {
    const current = await getCurrentAdapter(adapter);
    const [first] = await current.findMany<{ organizationId: string }>({
      model: 'member',
      where: [{ field: 'userId', value: userId }],
      sortBy: { field: 'createdAt', direction: 'asc' },
      limit: 1,
    });
    return first?.organizationId;
  }
  const first = await db
    .selectFrom('member')
    .select('organizationId')
    .where('userId', '=', userId)
    .orderBy('createdAt')
    .limit(1)
    .executeTakeFirst();
  return first?.organizationId;
}

/** A new session starts in the user's first family (by join date) when none is chosen. */
export function activeFamilyHooks(db: Database): NonNullable<BetterAuthOptions['databaseHooks']> {
  return {
    session: {
      create: {
        before: async (session, ctx) => {
          if (session['activeOrganizationId']) {
            return;
          }
          const familyId = await firstFamilyId(db, session.userId, ctx);
          if (!familyId) {
            return;
          }
          return { data: { ...session, activeOrganizationId: familyId } };
        },
      },
    },
  };
}
