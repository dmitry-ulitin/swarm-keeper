import { sql } from 'kysely';
import type { TestProject } from 'vitest/node';
import {
  TEST_DATABASE_NAME,
  createDatabase,
  createMigrator,
  ensureAppRoles,
} from '../src/database/index.js';

function testUrl(project: TestProject, name: string): URL {
  const url = new URL(String(project.config.env[name]));
  if (url.pathname !== `/${TEST_DATABASE_NAME}`) {
    throw new Error(
      `Refusing to use ${url.pathname} for ${name}: tests only use ${TEST_DATABASE_NAME}`,
    );
  }
  return url;
}

/**
 * Recreates the test database as the schema owner, makes sure the application roles exist and
 * migrates to latest. Tests then connect as the application role (`DATABASE_URL`), as the API does.
 * Both URLs come from `test.env` in vitest.config.ts and must name the test database.
 */
export default async function setup(project: TestProject): Promise<void> {
  testUrl(project, 'DATABASE_URL');
  const ownerUrl = testUrl(project, 'DATABASE_OWNER_URL');

  const maintenanceUrl = new URL(ownerUrl);
  maintenanceUrl.pathname = '/postgres';
  const admin = createDatabase(maintenanceUrl.toString());
  try {
    await sql`drop database if exists ${sql.id(TEST_DATABASE_NAME)} with (force)`.execute(admin);
    await sql`create database ${sql.id(TEST_DATABASE_NAME)}`.execute(admin);
    await ensureAppRoles(admin, { devLogin: true });
  } finally {
    await admin.destroy();
  }

  const db = createDatabase(ownerUrl.toString());
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
