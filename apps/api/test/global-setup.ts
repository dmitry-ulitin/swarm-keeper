import { sql } from 'kysely';
import type { TestProject } from 'vitest/node';
import { TEST_DATABASE_NAME, createDatabase, createMigrator } from '../src/database/index.js';

/**
 * Recreates the test database and migrates it to latest before API tests.
 * The URL comes from `test.env.DATABASE_URL` in vitest.config.ts and must name the test database.
 */
export default async function setup(project: TestProject): Promise<void> {
  const url = new URL(String(project.config.env['DATABASE_URL']));
  if (url.pathname !== `/${TEST_DATABASE_NAME}`) {
    throw new Error(`Refusing to recreate ${url.pathname}: tests only use ${TEST_DATABASE_NAME}`);
  }

  const maintenanceUrl = new URL(url);
  maintenanceUrl.pathname = '/postgres';
  const admin = createDatabase(maintenanceUrl.toString());
  try {
    await sql`drop database if exists ${sql.id(TEST_DATABASE_NAME)} with (force)`.execute(admin);
    await sql`create database ${sql.id(TEST_DATABASE_NAME)}`.execute(admin);
  } finally {
    await admin.destroy();
  }

  const db = createDatabase(url.toString());
  try {
    const { error, results } = await createMigrator(db).migrateToLatest();
    if (error) {
      const failed = results?.find((r) => r.status === 'Error')?.migrationName;
      throw new Error(`Test database migration failed${failed ? ` at ${failed}` : ''}`, {
        cause: error,
      });
    }
  } finally {
    await db.destroy();
  }
}
