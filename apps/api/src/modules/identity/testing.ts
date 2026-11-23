// Test helpers: build families, people and invitations straight in the database.
import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AuthService } from '@thallesp/nestjs-better-auth';
import { DATABASE, type Database, DatabaseModule } from '../../database/index.js';
import type { Auth } from './create-auth.js';
import { IdentityModule } from './identity.module.js';

let counter = 0;

/**
 * A fresh client IP per request. Rate limiting stays on in tests; distinct IPs keep
 * unrelated test requests out of one bucket, as Caddy's x-forwarded-for does in deployment.
 */
export function clientIp(): string {
  counter += 1;
  return `10.0.${Math.floor(counter / 250) % 250}.${(counter % 250) + 1}`;
}

/** A unique email per call, so tests sharing the database never collide. */
export function uniqueEmail(label: string): string {
  counter += 1;
  return `${label}-${Date.now()}-${counter}@example.test`;
}

export async function startAuthApp(): Promise<{ app: INestApplication; db: Database; auth: Auth }> {
  const moduleRef = await Test.createTestingModule({
    imports: [DatabaseModule, IdentityModule],
  }).compile();
  const app = moduleRef.createNestApplication({ bodyParser: false, logger: false });
  await app.init();
  return {
    app,
    db: app.get<Database>(DATABASE),
    auth: app.get<AuthService<Auth>>(AuthService).instance,
  };
}

export async function createUser(db: Database, email: string, emailVerified = true) {
  return db
    .insertInto('user')
    .values({ name: email, email, emailVerified, locale: 'en', uiSize: 'compact' })
    .returning(['id', 'email'])
    .executeTakeFirstOrThrow();
}

/** A family with an owner. */
export async function createFamily(db: Database) {
  const owner = await createUser(db, uniqueEmail('owner'));
  const family = await db
    .insertInto('organization')
    .values({ name: 'Family', slug: `family-${owner.id}`, createdAt: new Date() })
    .returning('id')
    .executeTakeFirstOrThrow();
  await db
    .insertInto('member')
    .values({ organizationId: family.id, userId: owner.id, role: 'owner', createdAt: new Date() })
    .execute();
  return { familyId: family.id, ownerId: owner.id };
}

export async function createInvitation(
  db: Database,
  input: {
    familyId: string;
    inviterId: string;
    email: string;
    role?: string;
    status?: string;
    expiresAt?: Date;
    locale?: string;
    uiSize?: string;
  },
) {
  return db
    .insertInto('invitation')
    .values({
      organizationId: input.familyId,
      inviterId: input.inviterId,
      email: input.email,
      role: input.role ?? 'member',
      status: input.status ?? 'pending',
      expiresAt: input.expiresAt ?? new Date(Date.now() + 24 * 60 * 60 * 1000),
      locale: input.locale ?? 'en',
      uiSize: input.uiSize ?? 'compact',
    })
    .returning('id')
    .executeTakeFirstOrThrow();
}
