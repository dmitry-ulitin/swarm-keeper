import { APIError } from 'better-auth/api';
import type { BetterAuthOptions } from 'better-auth';
import type { Database } from '../../database/index.js';

/** Error code of a sign-up without a valid invitation. */
export const INVITE_REQUIRED = 'INVITE_REQUIRED';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type HookContext = { body?: unknown } | null;

/** The invitation token arrives as `inviteToken` in the sign-up body. */
function inviteToken(ctx: HookContext): string | undefined {
  const body = ctx?.body;
  const token =
    body && typeof body === 'object' ? (body as Record<string, unknown>)['inviteToken'] : undefined;
  return typeof token === 'string' && UUID.test(token) ? token : undefined;
}

/** A pending, unexpired invitation with this id, whatever its email. */
export async function findPendingInvitationById(db: Database, id: string) {
  if (!UUID.test(id)) {
    return undefined;
  }
  return db
    .selectFrom('invitation')
    .select(['id', 'organizationId', 'inviterId', 'email', 'role', 'locale', 'uiSize', 'expiresAt'])
    .where('id', '=', id)
    .where('status', '=', 'pending')
    .where('expiresAt', '>', new Date())
    .executeTakeFirst();
}

/** A pending, unexpired invitation with this id for this email (case-insensitive). */
export async function findPendingInvitation(
  db: Database,
  email: string,
  token: string | undefined,
) {
  if (!token) {
    return undefined;
  }
  return db
    .selectFrom('invitation')
    .select(['id', 'organizationId', 'role', 'locale', 'uiSize'])
    .where('id', '=', token)
    .where('status', '=', 'pending')
    .where('expiresAt', '>', new Date())
    .where((eb) => eb(eb.fn('lower', ['email']), '=', email.toLowerCase()))
    .executeTakeFirst();
}

/**
 * Sign-up only from an invitation. The link mailed to the address proves the email,
 * so the account is created verified, and the person joins the family in the same request.
 *
 * The error is BAD_REQUEST, not FORBIDDEN: with requireEmailVerification, Better Auth 1.7.27
 * turns any 403 from user creation into a fake "success" response (anti-enumeration),
 * which would hide INVITE_REQUIRED from the client.
 */
export function inviteOnlyHooks(db: Database): NonNullable<BetterAuthOptions['databaseHooks']> {
  return {
    user: {
      create: {
        before: async (user, ctx) => {
          const invitation = await findPendingInvitation(db, user.email, inviteToken(ctx));
          if (!invitation) {
            throw new APIError('BAD_REQUEST', { code: INVITE_REQUIRED, message: INVITE_REQUIRED });
          }
          return {
            data: {
              ...user,
              emailVerified: true,
              locale: invitation.locale ?? 'en',
              uiSize: invitation.uiSize ?? 'compact',
            },
          };
        },
        after: async (user, ctx) => {
          const invitation = await findPendingInvitation(db, user.email, inviteToken(ctx));
          if (!invitation) {
            return;
          }
          await db.transaction().execute(async (trx) => {
            await trx
              .insertInto('member')
              .values({
                organizationId: invitation.organizationId,
                userId: user.id,
                role: invitation.role ?? 'member',
                createdAt: new Date(),
              })
              .execute();
            await trx
              .updateTable('invitation')
              .set({ status: 'accepted' })
              .where('id', '=', invitation.id)
              .execute();
          });
        },
      },
    },
  };
}
