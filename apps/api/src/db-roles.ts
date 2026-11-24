// pnpm db:roles [--dev-login] — creates the application role if missing; with --dev-login also
// the dev login swarm_app (local clusters outside production only). Run once per Postgres cluster
// as an admin (DATABASE_ADMIN_URL, else DATABASE_OWNER_URL), before `pnpm db:migrate`; idempotent.
import { Logger } from '@nestjs/common';
import {
  APP_ROLE,
  DEV_APP_LOGIN,
  assertDevLoginAllowed,
  createDatabase,
  databaseAdminUrl,
  ensureAppRoles,
} from './database/index.js';

const logger = new Logger('DbRoles');
const url = databaseAdminUrl();
const devLogin = process.argv.includes('--dev-login');
if (devLogin) {
  assertDevLoginAllowed(url);
}

const db = createDatabase(url);
try {
  await ensureAppRoles(db, { devLogin });
  logger.log(
    devLogin
      ? `Role ${APP_ROLE} and dev login ${DEV_APP_LOGIN.user} ready`
      : `Role ${APP_ROLE} ready`,
  );
} finally {
  await db.destroy();
}
