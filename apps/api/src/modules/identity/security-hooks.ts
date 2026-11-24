import { APIError, createAuthMiddleware } from 'better-auth/api';
import type { Database } from '../../database/index.js';
import type { SessionLookup } from './organization-hooks.js';
import { SESSION_NOT_FRESH } from './passkey-sign-up.js';
import { hasPassword } from './require-permission.js';

export const LAST_SIGN_IN_METHOD = 'LAST_SIGN_IN_METHOD';

type Hook = Parameters<typeof createAuthMiddleware>[0];
type Ctx = Parameters<Hook>[0];

/** Runs several `hooks.before` middlewares in order: Better Auth takes only one. */
export function combineBefore(...hooks: ReturnType<typeof createAuthMiddleware>[]) {
  return createAuthMiddleware(async (ctx) => {
    for (const hook of hooks) await hook(ctx);
  });
}

/**
 * Account safety rules on Better Auth's passkey routes:
 * - nobody deletes their last way to sign in (the only passkey of an account with no password);
 * - adding a passkey from a stale session is refused before the browser prompt, so the device
 *   never keeps a passkey the server did not store. Invitation sign-up has no session.
 *
 * The delete check is not atomic with the plugin's delete: two simultaneous deletes of the
 * last two passkeys could both pass. Accepted (see the 6b design).
 */
export function securityHooks(db: Database, lookupSession: SessionLookup) {
  return createAuthMiddleware(async (ctx) => {
    if (ctx.path === '/passkey/delete-passkey') await keepLastSignInMethod(db, lookupSession, ctx);
    else if (ctx.path === '/passkey/generate-register-options') await requireFresh(lookupSession, ctx);
  });
}

async function keepLastSignInMethod(db: Database, lookupSession: SessionLookup, ctx: Ctx) {
  const session = ctx.headers ? await lookupSession(ctx.headers) : null;
  const id = (ctx.body as { id?: unknown } | undefined)?.id;
  if (!session || typeof id !== 'string') return; // the plugin answers itself
  const userId = session.user.id;
  const owned = await db
    .selectFrom('passkey')
    .select('id')
    .where('userId', '=', userId)
    .execute();
  // A passkey that is not the caller's is left to the plugin's ownership check.
  if (!owned.some((key) => key.id === id)) return;
  if (owned.length <= 1 && !(await hasPassword(db, userId))) {
    throw new APIError('BAD_REQUEST', { code: LAST_SIGN_IN_METHOD, message: LAST_SIGN_IN_METHOD });
  }
}

async function requireFresh(lookupSession: SessionLookup, ctx: Ctx) {
  const session = ctx.headers ? await lookupSession(ctx.headers) : null;
  const createdAt = session?.session.createdAt;
  if (!createdAt) return;
  const freshAge = ctx.context.sessionConfig.freshAge;
  if (freshAge > 0 && Date.now() - new Date(createdAt).getTime() > freshAge * 1000) {
    throw new APIError('FORBIDDEN', { code: SESSION_NOT_FRESH, message: SESSION_NOT_FRESH });
  }
}
