import { Logger } from '@nestjs/common';
import { passkey } from '@better-auth/passkey';
import { ac, roles } from '@swarm-keeper/permissions';
import { type BetterAuthOptions, betterAuth } from 'better-auth';
import { getAuthTables } from 'better-auth/db';
import { bearer, organization, twoFactor } from 'better-auth/plugins';
import type { Database } from '../../database/index.js';
import type { AuthEnv } from './auth-env.js';
import { inviteOnlyHooks } from './invite-only.js';
import { passkeySignUp } from './passkey-sign-up.js';
import { type SessionLookup, activeFamilyHooks, organizationHooks } from './organization-hooks.js';
import { combineBefore, securityHooks } from './security-hooks.js';
import type { Mailer } from './mailer.js';
import { type ModelMapping, snakeCaseSchema } from './snake-case-schema.js';

const DAY = 60 * 60 * 24;

type Mapping = Record<string, ModelMapping | undefined>;

const mailLogger = new Logger('Mailer');

/** Sends without holding up the response; a failure is logged, as Better Auth does for awaited sends. */
function inBackground(sending: Promise<void>): void {
  sending.catch((error: unknown) => mailLogger.error('Sending an auth email failed', error));
}

/** `locale` is our additional field on users and invitations; Better Auth's types omit it. */
function localeOf(record: object): string {
  return String((record as { locale?: unknown }).locale ?? 'en');
}

/** The options as `authentication.md` specifies them, with an optional snake_case mapping. */
function buildOptions(env: AuthEnv, mailer: Mailer, map: Mapping, db?: Database) {
  return {
    appName: 'Swarm Keeper',
    baseURL: env.baseURL,
    basePath: '/api/auth',
    secret: env.secret,
    telemetry: { enabled: false },

    user: {
      ...map['user'],
      additionalFields: {
        locale: { type: 'string', defaultValue: 'en', fieldName: 'locale' },
        uiSize: { type: 'string', defaultValue: 'compact', fieldName: 'ui_size' },
      },
    },
    session: { ...map['session'], expiresIn: 30 * DAY, updateAge: DAY },
    account: { ...map['account'] },
    verification: { ...map['verification'] },

    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
      minPasswordLength: 12,
      // Not awaited: waiting for SMTP only for real accounts would reveal which emails exist.
      sendResetPassword: async ({ user, url }) =>
        inBackground(mailer.resetPassword({ email: user.email, url, locale: localeOf(user) })),
    },
    emailVerification: {
      sendOnSignUp: false, // the invitation link verifies the email on sign-up
      autoSignInAfterVerification: true,
      sendVerificationEmail: async ({ user, url }) =>
        inBackground(mailer.verifyEmail({ email: user.email, url, locale: localeOf(user) })),
    },

    rateLimit: { ...map['rateLimit'], enabled: true, storage: 'database' },
    advanced: {
      database: { generateId: 'uuid' }, // Postgres fills ids with uuidv7() (see the migration)
      useSecureCookies: env.secureCookies,
      // The client IP comes only from x-forwarded-for; see AuthEnv.trustedProxies.
      ipAddress: { trustedProxies: env.trustedProxies },
    },

    plugins: [
      organization({
        ac,
        roles,
        allowUserToCreateOrganization: false,
        invitationExpiresIn: 7 * DAY,
        requireEmailVerificationOnInvitation: true,
        sendInvitationEmail: async (data) => {
          await mailer.invitation({
            email: data.email,
            url: `${env.baseURL}/invite/${data.id}`,
            locale: localeOf(data.invitation),
            inviterName: data.inviter.user.name,
            familyName: data.organization.name,
            expiresAt: new Date(data.invitation.expiresAt),
          });
        },
        schema: {
          session: { fields: map['session']?.fields },
          organization: map['organization'],
          member: map['member'],
          invitation: {
            ...map['invitation'],
            additionalFields: {
              locale: { type: 'string', required: false, fieldName: 'locale' },
              uiSize: { type: 'string', required: false, fieldName: 'ui_size' },
            },
          },
        },
      }),
      passkey({
        rpID: env.passkeyRpId,
        rpName: 'Swarm Keeper',
        origin: env.baseURL,
        schema: { passkey: map['passkey'] },
        // Discoverable credentials, so "Sign in with passkey" needs no email.
        authenticatorSelection: { residentKey: 'required', userVerification: 'preferred' },
        // Passkey-first sign-up from an invitation; without a database (schema only) it is off.
        ...(db ? { registration: passkeySignUp(db) } : {}),
      }),
      twoFactor({
        issuer: 'Swarm Keeper',
        schema: { twoFactor: map['twoFactor'], user: { fields: map['user']?.fields } },
      }),
      bearer(),
    ],
  } satisfies BetterAuthOptions;
}

/** The final options: built once to learn the tables, then again with every name in snake_case. */
export function authOptions(env: AuthEnv, mailer: Mailer, db?: Database) {
  const tables = getAuthTables(buildOptions(env, mailer, {}));
  return buildOptions(env, mailer, snakeCaseSchema(tables), db);
}

/** Better Auth over our pool. Without plugins: Better Auth maps column names itself. */
export function createAuth(db: Database, env: AuthEnv, mailer: Mailer) {
  // Hooks need the finished instance to resolve sessions; bound right after creation.
  let lookupSession: SessionLookup = async () => null;
  const auth = betterAuth({
    ...authOptions(env, mailer, db),
    // Transactions on: a passkey sign-up writes the user, membership and passkey atomically.
    database: { db: db.withoutPlugins(), type: 'postgres', transaction: true },
    databaseHooks: { ...inviteOnlyHooks(db), ...activeFamilyHooks(db) },
    hooks: {
      before: combineBefore(
        organizationHooks(db, (headers) => lookupSession(headers)),
        securityHooks(db, (headers) => lookupSession(headers)),
      ),
    },
  });
  lookupSession = (headers) => auth.api.getSession({ headers });
  return auth;
}

export type Auth = ReturnType<typeof createAuth>;
