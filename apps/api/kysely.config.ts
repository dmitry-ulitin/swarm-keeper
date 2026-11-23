import { defineConfig } from 'kysely-ctl';
import { createDatabase, databaseUrl } from './src/database/index.js';

// Used by the `db:*` scripts. DATABASE_URL, or the dev database by default.
export default defineConfig({
  kysely: () => createDatabase(databaseUrl()),
  migrations: { migrationFolder: 'migrations' },
});
