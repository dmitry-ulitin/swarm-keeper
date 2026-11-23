import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Kysely } from 'kysely';
import { FileMigrationProvider, Migrator } from 'kysely/migration';

/** apps/api/migrations, from both src/database and dist/apps/api/src/database. */
function migrationFolder(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const apiRoot = here.includes(`${path.sep}dist${path.sep}`)
    ? here.slice(0, here.indexOf(`${path.sep}dist${path.sep}`))
    : path.resolve(here, '../..');
  return path.join(apiRoot, 'migrations');
}

/** The same migrations the `db:*` scripts run, for code that migrates itself (the test setup). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- the migrator ignores the schema type
export function createMigrator(db: Kysely<any>): Migrator {
  return new Migrator({
    db,
    provider: new FileMigrationProvider({ fs, path, migrationFolder: migrationFolder() }),
  });
}
