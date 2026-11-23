import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Database } from '../../database/index.js';
import type { Auth } from './create-auth.js';
import { seedOwner } from './seed-owner.js';
import { clientIp, startAuthApp, uniqueEmail } from './testing.js';

describe('seedOwner', () => {
  let app: INestApplication;
  let db: Database;
  let auth: Auth;

  beforeAll(async () => {
    ({ app, db, auth } = await startAuthApp());
  });

  afterAll(() => app.close());

  async function counts() {
    const count = async (table: 'user' | 'organization' | 'member') =>
      Number(
        (
          await db
            .selectFrom(table)
            .select((eb) => eb.fn.countAll().as('n'))
            .executeTakeFirstOrThrow()
        ).n,
      );
    return {
      users: await count('user'),
      families: await count('organization'),
      members: await count('member'),
    };
  }

  it('creates a verified owner who can sign in, and their family; a second run changes nothing', async () => {
    const input = {
      email: uniqueEmail('founder'),
      password: 'first owner password',
      familyName: 'The Ivanovs',
    };

    expect(await seedOwner(auth, db, input)).toEqual({ created: true });

    const owner = await db
      .selectFrom('user')
      .innerJoin('member', 'member.userId', 'user.id')
      .innerJoin('organization', 'organization.id', 'member.organizationId')
      .select(['user.emailVerified', 'member.role', 'organization.name', 'organization.slug'])
      .where('user.email', '=', input.email)
      .executeTakeFirstOrThrow();
    expect(owner).toMatchObject({ emailVerified: true, role: 'owner', name: 'The Ivanovs' });
    expect(owner.slug).toMatch(/^the-ivanovs/);

    await request(app.getHttpServer())
      .post('/api/auth/sign-in/email')
      .set('x-forwarded-for', clientIp())
      .send({ email: input.email, password: input.password })
      .expect(200);

    const before = await counts();
    expect(await seedOwner(auth, db, input)).toEqual({ created: false });
    expect(await counts()).toEqual(before);
  });
});
