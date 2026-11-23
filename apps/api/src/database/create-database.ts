import { CamelCasePlugin, Kysely, PostgresDialect } from 'kysely';
import pg from 'pg';
import type { DB } from './schema.js';

/**
 * Kysely over a `pg` pool. Columns are snake_case in the database and camelCase in code.
 * The pool connects lazily, on the first query.
 */
export function createDatabase(url: string): Kysely<DB> {
  return new Kysely<DB>({
    dialect: new PostgresDialect({ pool: new pg.Pool({ connectionString: url }) }),
    plugins: [new CamelCasePlugin()],
  });
}
