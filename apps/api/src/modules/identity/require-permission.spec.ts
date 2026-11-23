import { Controller, type INestApplication, Post } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Database } from '../../database/index.js';
import type { Auth } from './create-auth.js';
import { RequirePermission } from './require-permission.js';
import {
  clientIp,
  createFamily,
  createMember,
  enableTwoFactor,
  givePassword,
  sessionFor,
  startAuthApp,
} from './testing.js';

/** Test-only routes standing in for the archive's upload and admin endpoints. */
@Controller('test')
class GuardedController {
  @Post('assets')
  @RequirePermission('asset', 'create')
  upload() {
    return { ok: true };
  }

  @Post('purge')
  @RequirePermission('archive', 'purge-trash')
  purge() {
    return { ok: true };
  }
}

describe('RequirePermission', () => {
  let app: INestApplication;
  let db: Database;
  let auth: Auth;
  let family: { familyId: string; ownerId: string };

  beforeAll(async () => {
    ({ app, db, auth } = await startAuthApp([GuardedController]));
    family = await createFamily(db);
  });

  afterAll(() => app.close());

  function post(path: string, authorization: string) {
    return request(app.getHttpServer())
      .post(path)
      .set('Authorization', authorization)
      .set('x-forwarded-for', clientIp());
  }

  async function memberSession(role: string) {
    const user = await createMember(db, family.familyId, role);
    return { user, authorization: await sessionFor(auth, db, user.id, family.familyId) };
  }

  it('does not let a viewer upload', async () => {
    const { authorization } = await memberSession('viewer');
    await post('/test/assets', authorization).expect(403);
  });

  it('lets a member upload', async () => {
    const { authorization } = await memberSession('member');
    await post('/test/assets', authorization).expect(201);
  });

  it('keeps another family out of reach', async () => {
    const other = await createFamily(db);
    const { user } = await memberSession('member');
    const intoOther = await sessionFor(auth, db, user.id, other.familyId);
    await post('/test/assets', intoOther).expect(403);

    const own = await sessionFor(auth, db, user.id, family.familyId);
    const res = await post('/api/auth/organization/set-active', own).send({
      organizationId: other.familyId,
    });
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it('drops the rights of someone removed from the family, in the same session', async () => {
    const { user, authorization } = await memberSession('member');
    await post('/test/assets', authorization).expect(201);
    await db.deleteFrom('member').where('userId', '=', user.id).execute();
    await post('/test/assets', authorization).expect(403);
  });

  describe('2FA on admin actions', () => {
    it('asks an owner with a password and no 2FA to set it up', async () => {
      const { user, authorization } = await memberSession('owner');
      await givePassword(db, user.id);
      const res = await post('/test/purge', authorization).expect(403);
      expect(res.body).toMatchObject({ code: 'TWO_FACTOR_REQUIRED' });

      await enableTwoFactor(db, user.id);
      await post('/test/purge', await sessionFor(auth, db, user.id, family.familyId)).expect(201);
    });

    it('does not ask a passkey-only admin', async () => {
      const { authorization } = await memberSession('admin');
      await post('/test/purge', authorization).expect(201);
    });

    it('answers a member with FORBIDDEN, not a 2FA prompt', async () => {
      const { user, authorization } = await memberSession('member');
      await givePassword(db, user.id);
      const res = await post('/test/purge', authorization).expect(403);
      expect(res.body.code).not.toBe('TWO_FACTOR_REQUIRED');
    });

    it('does not ask for 2FA on ordinary actions', async () => {
      const { user, authorization } = await memberSession('owner');
      await givePassword(db, user.id);
      await post('/test/assets', authorization).expect(201);
    });
  });
});
