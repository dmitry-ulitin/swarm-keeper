import { Logger } from '@nestjs/common';
import { CamelCasePlugin, Kysely, PostgresDialect } from 'kysely';
import pg from 'pg';
import type { DB } from './schema.js';

const logger = new Logger('Database');

/**
 * Kysely over a `pg` pool. Columns are snake_case in the database and camelCase in code.
 * The pool connects lazily, on the first query.
 */
export function createDatabase(url: string, options: { max?: number } = {}): Kysely<DB> {
  const pool = new pg.Pool({ connectionString: url, ...options });
  // An idle client that Postgres drops (restart, failover, idle timeout) emits 'error' on the pool.
  // Without a listener Node crashes the process; the pool discards the client and reconnects.
  pool.on('error', (error) => logger.warn(`Idle database connection lost: ${error.message}`));
  return new Kysely<DB>({
    dialect: new PostgresDialect({ pool }),
    plugins: [new CamelCasePlugin()],
  });
}
