import type { PasskeyOptions } from '@better-auth/passkey';
import { getCurrentAdapter } from 'better-auth';
import { APIError } from 'better-auth/api';
import type { Database } from '../../database/index.js';
import { normalizeLocale } from './invitations.controller.js';
import { INVITE_REQUIRED, findPendingInvitationById } from './invite-only.js';

export const NAME_REQUIRED = 'NAME_REQUIRED';
export const SESSION_NOT_FRESH = 'SESSION_NOT_FRESH';
export const NAME_TOO_LONG = 'NAME_TOO_LONG';
/** The longest display name a person may give at sign-up. */
export const NAME_MAX_LENGTH = 64;

type Registration = NonNullable<PasskeyOptions['registration']>;

/** What the invitation page sends as the passkey `context`. */
interface SignUpContext {
  invitation: string;
  name: string;
  locale?: string;
}

/** The invitation a passkey sign-up is creating a user for, keyed by its request. */
const signUps = new WeakMap<object, { invitationId: string; locale: 'en' | 'ru' }>();

/** Set while a passkey sign-up creates its user, so the invite-only hooks can tell. */
export function passkeySignUpOf(ctx: unknown) {
  return ctx && typeof ctx === 'object' ? signUps.get(ctx) : undefined;
}

const rejected = (code: string) => new APIError('BAD_REQUEST', { code, message: code });

function parseContext(raw: string | null | undefined): SignUpContext {
  let value: unknown;
  try {
    value = raw ? JSON.parse(raw) : undefined;
  } catch {
    throw rejected(INVITE_REQUIRED);
  }
  const ctx = value as Partial<SignUpContext> | undefined;
  if (!ctx || typeof ctx.invitation !== 'string') throw rejected(INVITE_REQUIRED);
  if (typeof ctx.name !== 'string' || !ctx.name.trim()) throw rejected(NAME_REQUIRED);
  if (ctx.name.trim().length > NAME_MAX_LENGTH) throw rejected(NAME_TOO_LONG);
  return { invitation: ctx.invitation, name: ctx.name.trim(), locale: ctx.locale };
}

/** A pending invitation whose email has no account yet; anything else is INVITE_REQUIRED. */
async function openInvitation(db: Database, id: string) {
  const invitation = await findPendingInvitationById(db, id);
  if (!invitation) throw rejected(INVITE_REQUIRED);
  const taken = await db
    .selectFrom('user')
    .select('id')
    .where((eb) => eb(eb.fn('lower', ['email']), '=', invitation.email.toLowerCase()))
    .executeTakeFirst();
  if (taken) throw rejected(INVITE_REQUIRED);
  return invitation;
}

/**
 * Passkey-first sign-up: someone with an invitation creates their account with a passkey and
 * no password. Signed-in users keep registering passkeys for themselves; Better Auth resolves
 * them from the session and never calls resolveUser for them.
 */
export function passkeySignUp(db: Database): Registration {
  return {
    requireSession: false,
    resolveUser: async ({ context }) => {
      const { invitation: id, name } = parseContext(context);
      const invitation = await openInvitation(db, id);
      // A placeholder until afterVerification creates the user: the invitation id is a UUID
      // no passkey belongs to. The WebAuthn user handle is random either way.
      return { id: invitation.id, name: invitation.email, displayName: name };
    },
    afterVerification: async ({ ctx, context }) => {
      const session = ctx.context.session;
      if (session?.user?.id) {
        // requireSession: false also drops the plugin's fresh-session middleware; keep the rule:
        // only a recent sign-in may add a passkey, so a stolen old session cannot plant one.
        const freshAge = ctx.context.sessionConfig.freshAge;
        const createdAt = new Date(session.session.createdAt).getTime();
        if (freshAge > 0 && Date.now() - createdAt > freshAge * 1000) {
          throw new APIError('FORBIDDEN', { code: SESSION_NOT_FRESH, message: SESSION_NOT_FRESH });
        }
        return;
      }
      // createSession makes Better Auth run this inside its registration transaction.
      if ((ctx.body as { createSession?: unknown } | undefined)?.createSession !== true) {
        throw rejected(INVITE_REQUIRED);
      }
      const { invitation: id, name, locale } = parseContext(context);
      const invitation = await openInvitation(db, id);
      const chosen =
        locale === 'en' || locale === 'ru' ? locale : normalizeLocale(invitation.locale);
      signUps.set(ctx, { invitationId: invitation.id, locale: chosen });
      try {
        // Through Better Auth so the user hooks run; a second sign-up for the same email fails
        // on the unique email and rolls the whole registration back.
        const user = await ctx.context.internalAdapter.createUser(
          {
            email: invitation.email,
            name,
            emailVerified: true,
            locale: chosen,
            uiSize: invitation.uiSize ?? 'compact',
          },
          { method: 'passkey' },
        );
        const adapter = await getCurrentAdapter(ctx.context.adapter);
        await adapter.create({
          model: 'member',
          data: {
            organizationId: invitation.organizationId,
            userId: user.id,
            role: invitation.role ?? 'member',
            createdAt: new Date(),
          },
        });
        await adapter.update({
          model: 'invitation',
          where: [{ field: 'id', value: invitation.id }],
          update: { status: 'accepted' },
        });
        return { userId: user.id };
      } finally {
        signUps.delete(ctx);
      }
    },
  };
}
