import { passkey } from '@better-auth/passkey';
import { ac, roles } from '@swarm-keeper/permissions';
import { type BetterAuthOptions, betterAuth } from 'better-auth';
import { getAuthTables } from 'better-auth/db';
import { bearer, organization, twoFactor } from 'better-auth/plugins';
import type { Database } from '../../database/index.js';
import type { AuthEnv } from './auth-env.js';
import { inviteOnlyHooks } from './invite-only.js';
import type { Mailer } from './mailer.js';
import { type ModelMapping, snakeCaseSchema } from './snake-case-schema.js';

const DAY = 60 * 60 * 24;

type Mapping = Record<string, ModelMapping | undefined>;

/** The options as `authentication.md` specifies them, with an optional snake_case mapping. */
function buildOptions(env: AuthEnv, mailer: Mailer, map: Mapping) {
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
      sendResetPassword: ({ user, url }) => mailer.resetPassword({ email: user.email, url }),
    },
    emailVerification: {
      sendOnSignUp: false, // the invitation link verifies the email on sign-up
      autoSignInAfterVerification: true,
      sendVerificationEmail: ({ user, url }) => mailer.verifyEmail({ email: user.email, url }),
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
            locale: String((data.invitation as { locale?: string }).locale ?? 'en'),
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
export function authOptions(env: AuthEnv, mailer: Mailer) {
  const tables = getAuthTables(buildOptions(env, mailer, {}));
  return buildOptions(env, mailer, snakeCaseSchema(tables));
}

/** Better Auth over our pool. Without plugins: Better Auth maps column names itself. */
export function createAuth(db: Database, env: AuthEnv, mailer: Mailer) {
  return betterAuth({
    ...authOptions(env, mailer),
    database: { db: db.withoutPlugins(), type: 'postgres' },
    databaseHooks: inviteOnlyHooks(db),
  });
}

export type Auth = ReturnType<typeof createAuth>;
