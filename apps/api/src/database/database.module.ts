import { Global, Inject, Module, type OnApplicationShutdown } from '@nestjs/common';
import type { Kysely } from 'kysely';
import { createDatabase } from './create-database.js';
import { databaseUrl } from './database-url.js';
import type { DB } from './schema.js';

/** Injection token for the Kysely instance: `@Inject(DATABASE) db: Database`. */
export const DATABASE = Symbol('DATABASE');

export type Database = Kysely<DB>;

/**
 * One connection pool per process, for the API and the worker.
 * Closed in the last shutdown phase, after the HTTP server has finished in-flight requests.
 */
@Global()
@Module({
  providers: [{ provide: DATABASE, useFactory: (): Database => createDatabase(databaseUrl()) }],
  exports: [DATABASE],
})
export class DatabaseModule implements OnApplicationShutdown {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async onApplicationShutdown(): Promise<void> {
    await this.db.destroy();
  }
}
