/** Matches the dev compose stack (`compose.yaml`, `infra/dev/env.sh`). Development only. */
export const DEV_DATABASE_URL = 'postgres://swarm_app:swarm_app@127.0.0.1:5432/swarm_keeper';
/** The schema owner (the compose superuser): migrations, codegen, test database resets. */
export const DEV_DATABASE_OWNER_URL = 'postgres://swarm:swarm@127.0.0.1:5432/swarm_keeper';
/** The only database the test setup is allowed to drop and recreate. */
export const TEST_DATABASE_NAME = 'swarm_keeper_test';

function urlFrom(env: NodeJS.ProcessEnv, name: string, devDefault: string): string {
  if (env[name]) {
    return env[name];
  }
  if (env['NODE_ENV'] === 'production') {
    throw new Error(`${name} is required in production`);
  }
  return devDefault;
}

/** `DATABASE_URL` (the application role, see app-role.ts), or the dev URL outside production. */
export function databaseUrl(env: NodeJS.ProcessEnv = process.env): string {
  return urlFrom(env, 'DATABASE_URL', DEV_DATABASE_URL);
}

/** `DATABASE_OWNER_URL` (the schema owner, for migrations), or the dev URL outside production. */
export function databaseOwnerUrl(env: NodeJS.ProcessEnv = process.env): string {
  return urlFrom(env, 'DATABASE_OWNER_URL', DEV_DATABASE_OWNER_URL);
}

/** The same server and credentials, pointed at the test database. */
export function testDatabaseUrl(url: string): string {
  const parsed = new URL(url);
  parsed.pathname = `/${TEST_DATABASE_NAME}`;
  return parsed.toString();
}
