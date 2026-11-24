import { Logger } from '@nestjs/common';
import { sql } from 'kysely';
import { APP_ROLE } from './app-role.js';
import type { Database } from './database.module.js';

/** The connected role is a superuser or bypasses RLS. */
export class UnsafeDatabaseRoleError extends Error {}

/**
 * RLS does not apply to a superuser or a BYPASSRLS role, so the API and the worker refuse to run
 * as one. Development only warns: a developer may point DATABASE_URL at the owner on purpose.
 */
export async function checkDatabaseRole(
  db: Database,
  env: NodeJS.ProcessEnv = process.env,
  logger: Pick<Logger, 'warn'> = new Logger('Database'),
): Promise<void> {
  const { rows } = await sql<{ name: string; bypasses: boolean }>`
    select rolname as name, rolsuper or rolbypassrls as bypasses
    from pg_roles where rolname = current_user`.execute(db);
  const role = rows[0];
  if (!role?.bypasses) {
    return;
  }
  const message =
    `Database role ${role.name} is a superuser or bypasses RLS, so family isolation would not ` +
    `apply. Connect DATABASE_URL as a login in ${APP_ROLE} (see pnpm db:roles).`;
  if (env['NODE_ENV'] === 'development') {
    logger.warn(message);
    return;
  }
  throw new UnsafeDatabaseRoleError(message);
}

export interface WatchOptions {
  env?: NodeJS.ProcessEnv;
  logger?: Pick<Logger, 'warn' | 'error'>;
  retryMs?: number;
  /** Called when a background retry finds an unsafe role; the default exits the process. */
  onFatal?: () => void;
}

/**
 * Runs checkDatabaseRole at start without making the database a start-up dependency: a reachable
 * database with an unsafe role fails the start; an unreachable one is checked again in the
 * background until it answers, and an unsafe role found then stops the process.
 */
export async function watchDatabaseRole(
  db: Database,
  options: WatchOptions = {},
): Promise<{ stop(): void }> {
  const {
    env = process.env,
    logger = new Logger('Database'),
    retryMs = 5_000,
    onFatal = () => process.exit(1),
  } = options;
  let timer: NodeJS.Timeout | undefined;
  let stopped = false;
  const stop = () => {
    stopped = true;
    clearTimeout(timer);
  };

  // Resolves true when the check is settled (passed or warned), false when it must be retried.
  const attempt = async (): Promise<boolean> => {
    try {
      await checkDatabaseRole(db, env, logger);
      return true;
    } catch (error) {
      if (error instanceof UnsafeDatabaseRoleError) {
        throw error;
      }
      logger.warn(`Database role not checked yet (${(error as Error).message}); retrying`);
      return false;
    }
  };
  const retry = () => {
    timer = setTimeout(() => {
      attempt().then(
        (done) => !done && !stopped && retry(),
        (error: Error) => {
          logger.error(error.message);
          onFatal();
        },
      );
    }, retryMs);
    timer.unref();
  };

  if (!(await attempt())) {
    retry();
  }
  return { stop };
}
