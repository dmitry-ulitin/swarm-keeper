// E2E database steps that need SQL, run through the owner URL with pg (no psql, no docker exec),
// so they work against the compose Postgres and a CI service container alike.
//   node prepare-db.mjs reset           drop and recreate the e2e database
//   node prepare-db.mjs second-family   a second family owned by the seeded owner
// Called by prepare-api.sh, which sets DATABASE_OWNER_URL.
import pg from 'pg';

const ownerUrl = process.env.DATABASE_OWNER_URL;
if (!ownerUrl) {
  throw new Error('DATABASE_OWNER_URL is required');
}

async function withClient(url, fn) {
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

const target = new URL(ownerUrl);
const name = target.pathname.slice(1);
if (name !== 'swarm_keeper_e2e') {
  throw new Error(`Refusing to touch ${name}: only swarm_keeper_e2e`);
}

switch (process.argv[2]) {
  case 'reset': {
    const maintenance = new URL(target);
    maintenance.pathname = '/postgres';
    await withClient(maintenance.toString(), async (client) => {
      await client.query(`drop database if exists ${name} with (force)`);
      await client.query(`create database ${name}`);
    });
    break;
  }
  case 'second-family':
    // Regular users cannot create families, so the second one goes in directly.
    await withClient(ownerUrl, (client) =>
      client.query(`
        with family as (
          insert into organization (name, slug, created_at) values ('Петровы', 'petrovy', now()) returning id
        )
        insert into member (organization_id, user_id, role, created_at)
        select family.id, u.id, 'owner', now() from family, "user" u where u.email = 'owner@e2e.test'`),
    );
    break;
  default:
    throw new Error(`Unknown step ${process.argv[2]}`);
}
