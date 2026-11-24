import {
  Global,
  Inject,
  Module,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from '@nestjs/common';
import { watchDatabaseRole } from './check-database-role.js';
import { FamilyDb } from './family-db.js';
import { createDatabase } from './create-database.js';
import { databaseUrl } from './database-url.js';
import { DATABASE, type Database } from './database.token.js';

export { DATABASE, type Database } from './database.token.js';

/**
 * One connection pool per process, for the API and the worker.
 * At start it checks that the role is subject to RLS (watchDatabaseRole); the database need not be up.
 * Closed in the last shutdown phase, after the HTTP server has finished in-flight requests.
 */
@Global()
@Module({
  providers: [
    { provide: DATABASE, useFactory: (): Database => createDatabase(databaseUrl()) },
    FamilyDb,
  ],
  exports: [DATABASE, FamilyDb],
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
