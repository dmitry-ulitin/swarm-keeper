import {
  Global,
  Inject,
  Module,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from '@nestjs/common';
import type { Kysely } from 'kysely';
import { watchDatabaseRole } from './check-database-role.js';
import { createDatabase } from './create-database.js';
import { databaseUrl } from './database-url.js';
import type { DB } from './schema.js';

/** Injection token for the Kysely instance: `@Inject(DATABASE) db: Database`. */
export const DATABASE = Symbol('DATABASE');

export type Database = Kysely<DB>;

/**
 * One connection pool per process, for the API and the worker.
 * At start it checks that the role is subject to RLS (watchDatabaseRole); the database need not be up.
 * Closed in the last shutdown phase, after the HTTP server has finished in-flight requests.
 */
@Global()
@Module({
  providers: [{ provide: DATABASE, useFactory: (): Database => createDatabase(databaseUrl()) }],
  exports: [DATABASE],
})
export class DatabaseModule implements OnApplicationBootstrap, OnApplicationShutdown {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  private roleWatch?: { stop(): void };

  async onApplicationBootstrap(): Promise<void> {
    this.roleWatch = await watchDatabaseRole(this.db);
  }

  async onApplicationShutdown(): Promise<void> {
    this.roleWatch?.stop();
    await this.db.destroy();
  }
}
