import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Database } from '../../database/index.js';
import type { Auth } from './create-auth.js';
import {
  clientIp,
  createFamily,
  createInvitation,
  createMember,
  createUser,
  enableTwoFactor,
  givePassword,
  sessionFor,
  startAuthApp,
  uniqueEmail,
} from './testing.js';

describe('family admin routes (Better Auth organization)', () => {
  let app: INestApplication;
  let db: Database;
  let auth: Auth;
  let familyId: string;

  beforeAll(async () => {
    ({ app, db, auth } = await startAuthApp());
    ({ familyId } = await createFamily(db));
  });

  afterAll(() => app.close());

  function post(path: string, authorization: string, body: object) {
    return request(app.getHttpServer())
      .post(`/api/auth/organization/${path}`)
      .set('Authorization', authorization)
      .set('x-forwarded-for', clientIp())
      .send(body);
  }

  /** A family member with a password and 2FA on, as a session. */
  async function secured(role: string) {
    const user = await createMember(db, familyId, role);
    await givePassword(db, user.id);
    await enableTwoFactor(db, user.id);
    return sessionFor(auth, db, user.id, familyId);
  }

  async function memberId(role: string) {
    const user = await createMember(db, familyId, role);
    const row = await db
      .selectFrom('member')
      .select('id')
      .where('userId', '=', user.id)
      .executeTakeFirstOrThrow();
    return row.id;
  }

  describe('creatorRole: only an owner grants the owner role', () => {
    it('lets an owner invite an owner', async () => {
      await post('invite-member', await secured('owner'), {
        email: uniqueEmail('co-owner'),
        role: 'owner',
      }).expect(200);
    });

    it('does not let an admin invite an owner', async () => {
      const res = await post('invite-member', await secured('admin'), {
        email: uniqueEmail('x'),
        role: 'owner',
      });
      expect(res.status).toBeGreaterThanOrEqual(400);
    });

    it('does not let an admin promote a member to owner', async () => {
      const res = await post('update-member-role', await secured('admin'), {
        memberId: await memberId('member'),
        role: 'owner',
      });
      expect(res.status).toBeGreaterThanOrEqual(400);
    });

    it('lets an owner promote a member to owner', async () => {
      await post('update-member-role', await secured('owner'), {
        memberId: await memberId('member'),
        role: 'owner',
      }).expect(200);
    });
  });

  describe('one role per member', () => {
    it.each(['admin,member', 'admin, member', 'member,', ' member'])(
      'rejects %j on invite',
      async (role) => {
        const res = await post('invite-member', await secured('owner'), {
          email: uniqueEmail('list'),
          role,
        });
        expect(res.status).toBe(400);
        expect(res.body.code).toBe('SINGLE_ROLE_REQUIRED');
      },
    );

    it('rejects a role array on invite', async () => {
      const res = await post('invite-member', await secured('owner'), {
        email: uniqueEmail('array'),
        role: ['admin', 'member'],
      });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('SINGLE_ROLE_REQUIRED');
    });

    it('rejects a role list on role change', async () => {
      const res = await post('update-member-role', await secured('owner'), {
        memberId: await memberId('member'),
        role: 'admin,member',
      });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('SINGLE_ROLE_REQUIRED');
    });
  });

  describe('2FA for owners and admins with a password', () => {
    async function ownerWithoutTwoFactor() {
      const user = await createMember(db, familyId, 'owner');
      await givePassword(db, user.id);
      return { user, authorization: await sessionFor(auth, db, user.id, familyId) };
    }

    it('blocks inviting and removing members until 2FA is on', async () => {
      const { user, authorization } = await ownerWithoutTwoFactor();
      const invite = await post('invite-member', authorization, {
        email: uniqueEmail('n'),
        role: 'member',
      });
      expect(invite.status).toBe(403);
      expect(invite.body.code).toBe('TWO_FACTOR_REQUIRED');

      const target = await memberId('viewer');
      const remove = await post('remove-member', authorization, { memberIdOrEmail: target });
      expect(remove.status).toBe(403);
      expect(remove.body.code).toBe('TWO_FACTOR_REQUIRED');

      await enableTwoFactor(db, user.id);
      await post('remove-member', await sessionFor(auth, db, user.id, familyId), {
        memberIdOrEmail: target,
      }).expect(200);
    });

    it('blocks cancelling an invitation until 2FA is on', async () => {
      const { user, authorization } = await ownerWithoutTwoFactor();
      const invitation = await createInvitation(db, {
        familyId,
        inviterId: user.id,
        email: uniqueEmail('c'),
      });
      const res = await post('cancel-invitation', authorization, { invitationId: invitation.id });
      expect(res.body.code).toBe('TWO_FACTOR_REQUIRED');
    });

    it('answers a member with Better Auth’s refusal, not a 2FA prompt', async () => {
      const user = await createMember(db, familyId, 'member');
      await givePassword(db, user.id);
      const res = await post('invite-member', await sessionFor(auth, db, user.id, familyId), {
        email: uniqueEmail('m'),
        role: 'viewer',
      });
      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(res.body.code).not.toBe('TWO_FACTOR_REQUIRED');
    });
  });

  describe('active family at sign-in', () => {
    async function signInWithPassword(email: string, password: string) {
      const res = await request(app.getHttpServer())
        .post('/api/auth/sign-in/email')
        .set('x-forwarded-for', clientIp())
        .send({ email, password })
        .expect(200);
      const session = await request(app.getHttpServer())
        .get('/api/auth/get-session')
        .set('Authorization', `Bearer ${res.body.token}`)
        .set('x-forwarded-for', clientIp())
        .expect(200);
      return session.body.session.activeOrganizationId as string | null;
    }

    async function userWithPassword(password: string) {
      const user = await createUser(db, uniqueEmail('signin'));
      const ctx = await auth.$context;
      await db
        .insertInto('account')
        .values({
          userId: user.id,
          accountId: user.id,
          providerId: 'credential',
          password: await ctx.password.hash(password),
          updatedAt: new Date(),
        })
        .execute();
      return user;
    }

    it('makes the first family active', async () => {
      const user = await userWithPassword('a long test password');
      const later = await createFamily(db);
      await db
        .insertInto('member')
        .values({
          organizationId: familyId,
          userId: user.id,
          role: 'member',
          createdAt: new Date(Date.now() - 60_000),
        })
        .execute();
      await db
        .insertInto('member')
        .values({
          organizationId: later.familyId,
          userId: user.id,
          role: 'member',
          createdAt: new Date(),
        })
        .execute();
      expect(await signInWithPassword(user.email, 'a long test password')).toBe(familyId);
    });

    it('leaves it empty for someone without a family', async () => {
      const user = await userWithPassword('a long test password');
      expect(await signInWithPassword(user.email, 'a long test password')).toBeNull();
    });
  });
});
