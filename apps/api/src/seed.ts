// pnpm db:seed — creates the first owner and family. Run once per installation.
import { Logger } from '@nestjs/common';
import { createDatabase, databaseUrl } from './database/index.js';
import { LoggingMailer, authEnv, createAuth, seedOwner } from './modules/identity/index.js';

const logger = new Logger('Seed');

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

const input = {
  email: requireEnv('SEED_OWNER_EMAIL'),
  password: requireEnv('SEED_OWNER_PASSWORD'),
  familyName: requireEnv('SEED_FAMILY_NAME'),
};

const db = createDatabase(databaseUrl());
try {
  const { created } = await seedOwner(createAuth(db, authEnv(), new LoggingMailer()), db, input);
  logger.log(
    created
      ? `Created owner ${input.email} and family "${input.familyName}"`
      : `${input.email} already exists; nothing changed`,
  );
} finally {
  await db.destroy();
}
