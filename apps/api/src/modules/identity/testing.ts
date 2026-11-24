// Test helpers: build families, people and invitations straight in the database.
import 'reflect-metadata';
import type { INestApplication, Type } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AuthService } from '@thallesp/nestjs-better-auth';
import {
  DATABASE,
  type Database,
  DatabaseModule,
  createDatabase,
  databaseOwnerUrl,
} from '../../database/index.js';
import type { Auth } from './create-auth.js';
import { IdentityModule } from './identity.module.js';
import { MAILER, type Mailer } from './mailer.js';

let counter = 0;

/**
 * A fresh client IP per request. Rate limiting stays on in tests; distinct IPs keep
 * unrelated test requests out of one bucket, as the reverse proxy's x-forwarded-for does in deployment.
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

/**
 * A connection as the schema owner (DATABASE_OWNER_URL, the test database), for tests that change
 * the schema; the application role has no DDL rights. Destroy it when done.
 */
export function ownerDatabase(): Database {
  return createDatabase(databaseOwnerUrl());
}

export async function startAuthApp(
  controllers: Type[] = [],
  options: { mailer?: Mailer } = {},
): Promise<{ app: INestApplication; db: Database; auth: Auth }> {
  let builder = Test.createTestingModule({
    imports: [DatabaseModule, IdentityModule],
    controllers,
  });
  if (options.mailer) {
    builder = builder.overrideProvider(MAILER).useValue(options.mailer);
  }
  const moduleRef = await builder.compile();
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

export async function addMember(db: Database, familyId: string, userId: string, role: string) {
  await db
    .insertInto('member')
    .values({ organizationId: familyId, userId, role, createdAt: new Date() })
    .execute();
}

/** A person with a verified account, a member of the family with the given role. */
export async function createMember(db: Database, familyId: string, role: string) {
  const user = await createUser(db, uniqueEmail(role));
  await addMember(db, familyId, user.id, role);
  return user;
}

/** A password (credential) account; the hash is never checked by these tests. */
export async function givePassword(db: Database, userId: string) {
  await db
    .insertInto('account')
    .values({
      userId,
      accountId: userId,
      providerId: 'credential',
      password: 'unused',
      updatedAt: new Date(),
    })
    .execute();
}

export async function enableTwoFactor(db: Database, userId: string) {
  await db.updateTable('user').set({ twoFactorEnabled: true }).where('id', '=', userId).execute();
}

/**
 * A session for the user with the given active family (or none), as a bearer token.
 * Skips sign-in: these tests are about what a session may do, not how it was opened.
 */
export async function sessionFor(
  auth: Auth,
  db: Database,
  userId: string,
  activeFamilyId: string | null,
) {
  const ctx = await auth.$context;
  const session = await ctx.internalAdapter.createSession(userId);
  await db
    .updateTable('session')
    .set({ activeOrganizationId: activeFamilyId })
    .where('id', '=', session.id)
    .execute();
  return `Bearer ${session.token}`;
}
