import { defineConfig } from 'kysely-ctl';
// Not the barrel: the CLI needs only the connection, not the Nest module.
/* eslint-disable @sheriff-arch/sheriff/encapsulation */
import { createDatabase } from './src/database/create-database.js';
import { databaseUrl } from './src/database/database-url.js';
/* eslint-enable @sheriff-arch/sheriff/encapsulation */

// Used by the `db:*` scripts. DATABASE_URL, or the dev database by default.
export default defineConfig({
  kysely: () => createDatabase(databaseUrl()),
  migrations: { migrationFolder: 'migrations' },
});
