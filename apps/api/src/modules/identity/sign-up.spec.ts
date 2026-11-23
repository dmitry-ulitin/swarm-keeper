import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Database } from '../../database/index.js';
import type { Auth } from './create-auth.js';
import {
  clientIp,
  createFamily,
  createInvitation,
  createUser,
  startAuthApp,
  uniqueEmail,
} from './testing.js';

const PASSWORD = 'correct horse battery';

describe('invite-only sign-up', () => {
  let app: INestApplication;
  let db: Database;
  let auth: Auth;
  let family: { familyId: string; ownerId: string };

  beforeAll(async () => {
    ({ app, db, auth } = await startAuthApp());
    family = await createFamily(db);
  });

  afterAll(() => app.close());

  function signUp(email: string, inviteToken?: string) {
    return request(app.getHttpServer())
      .post('/api/auth/sign-up/email')
      .set('x-forwarded-for', clientIp())
      .send({
        name: 'Grandma',
        email,
        password: PASSWORD,
        ...(inviteToken ? { inviteToken } : {}),
      });
  }

  async function userRow(email: string) {
    return db.selectFrom('user').selectAll().where('email', '=', email).executeTakeFirst();
  }

  async function expectRejected(email: string, inviteToken?: string) {
    const res = await signUp(email, inviteToken);
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVITE_REQUIRED');
    expect(await userRow(email)).toBeUndefined();
  }

  it('rejects a sign-up without an invitation', async () => {
    await expectRejected(uniqueEmail('stranger'));
  });

  it('rejects an invitation used with another email', async () => {
    const invitation = await createInvitation(db, {
      ...family,
      inviterId: family.ownerId,
      email: uniqueEmail('invited'),
    });
    await expectRejected(uniqueEmail('someone-else'), invitation.id);
  });

  it('rejects a made-up token', async () => {
    await expectRejected(uniqueEmail('guess'), '00000000-0000-7000-8000-000000000000');
  });

  it.each([
    ['expired', { expiresAt: new Date(Date.now() - 1000) }],
    ['canceled', { status: 'canceled' }],
    ['accepted', { status: 'accepted' }],
    ['rejected', { status: 'rejected' }],
  ])('rejects a %s invitation', async (_name, overrides) => {
    const email = uniqueEmail('late');
    const invitation = await createInvitation(db, {
      ...family,
      inviterId: family.ownerId,
      email,
      ...overrides,
    });
    await expectRejected(email, invitation.id);
  });

  it('signs up from a valid invitation: verified, in the family with the invited role', async () => {
    const email = uniqueEmail('cousin');
    const invitation = await createInvitation(db, {
      ...family,
      inviterId: family.ownerId,
      email,
      role: 'viewer',
      locale: 'ru',
      uiSize: 'large',
    });

    // Case-insensitive match on the email.
    const res = await signUp(email.toUpperCase(), invitation.id);
    expect(res.status).toBe(200);

    const user = await userRow(email);
    expect(user).toMatchObject({ emailVerified: true, locale: 'ru', uiSize: 'large' });
    const member = await db
      .selectFrom('member')
      .select('role')
      .where('userId', '=', user!.id)
      .where('organizationId', '=', family.familyId)
      .executeTakeFirst();
    expect(member).toEqual({ role: 'viewer' });
    const after = await db
      .selectFrom('invitation')
      .select('status')
      .where('id', '=', invitation.id)
      .executeTakeFirstOrThrow();
    expect(after.status).toBe('accepted');

    // The verified account can sign in right away.
    await request(app.getHttpServer())
      .post('/api/auth/sign-in/email')
      .set('x-forwarded-for', clientIp())
      .send({ email, password: PASSWORD })
      .expect(200);
  });

  it('does not let an unverified account accept an invitation', async () => {
    const user = await createUser(db, uniqueEmail('unverified'), false);
    const invitation = await createInvitation(db, {
      ...family,
      inviterId: family.ownerId,
      email: user.email,
    });
    const ctx = await auth.$context;
    const session = await ctx.internalAdapter.createSession(user.id);

    const res = await request(app.getHttpServer())
      .post('/api/auth/organization/accept-invitation')
      .set('Authorization', `Bearer ${session.token}`)
      .set('x-forwarded-for', clientIp())
      .send({ invitationId: invitation.id });
    expect(res.status).toBeGreaterThanOrEqual(400);

    const member = await db
      .selectFrom('member')
      .select('id')
      .where('userId', '=', user.id)
      .executeTakeFirst();
    expect(member).toBeUndefined();
  });
});
