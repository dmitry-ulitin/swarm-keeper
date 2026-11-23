/** Matches the dev compose stack (`compose.yaml`, `infra/dev/env.sh`). Development only. */
export const DEV_DATABASE_URL = 'postgres://swarm:swarm@127.0.0.1:5432/swarm_keeper';

/** The only database the test setup is allowed to drop and recreate. */
export const TEST_DATABASE_NAME = 'swarm_keeper_test';

/** `DATABASE_URL`, or the dev URL outside production. */
export function databaseUrl(env: NodeJS.ProcessEnv = process.env): string {
  if (env['DATABASE_URL']) {
    return env['DATABASE_URL'];
  }
  if (env['NODE_ENV'] === 'production') {
    throw new Error('DATABASE_URL is required in production');
  }
  return DEV_DATABASE_URL;
}

/** The same server and credentials, pointed at the test database. */
export function testDatabaseUrl(url: string): string {
  const parsed = new URL(url);
  parsed.pathname = `/${TEST_DATABASE_NAME}`;
  return parsed.toString();
}
