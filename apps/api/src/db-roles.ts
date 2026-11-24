// pnpm db:roles — creates the application role (and in development its dev login) if missing.
// Run once per Postgres cluster as an admin, before `pnpm db:migrate`; idempotent.
import { Logger } from '@nestjs/common';
import {
  APP_ROLE,
  DEV_APP_LOGIN,
  createDatabase,
  databaseOwnerUrl,
  ensureAppRoles,
} from './database/index.js';

const logger = new Logger('DbRoles');
const devLogin = process.env['NODE_ENV'] === 'development';

const db = createDatabase(databaseOwnerUrl());
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
