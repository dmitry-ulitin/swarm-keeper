import { Controller, Get, type INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Database, FamilyContext } from '../../database/index.js';
import type { Auth } from './create-auth.js';
import { Family } from './family-context.js';
import { RequirePermission } from './require-permission.js';
import { clientIp, createFamily, createMember, sessionFor, startAuthApp } from './testing.js';

@Controller('test')
class FamilyController {
  @Get('family')
  @RequirePermission('asset', 'read')
  family(@Family() ctx: FamilyContext) {
    return ctx;
  }

  /** A programming error: @Family() without RequirePermission. */
  @Get('unguarded')
  unguarded(@Family() ctx: FamilyContext) {
    return ctx;
  }
}

describe('@Family()', () => {
  let app: INestApplication;
  let db: Database;
  let auth: Auth;
  let family: { familyId: string; ownerId: string };

  beforeAll(async () => {
    ({ app, db, auth } = await startAuthApp([FamilyController]));
    family = await createFamily(db);
  });
  afterAll(() => app.close());

  function get(path: string, authorization: string) {
    return request(app.getHttpServer())
      .get(path)
      .set('Authorization', authorization)
      .set('x-forwarded-for', clientIp());
  }

  it('takes the family from the membership row', async () => {
    const user = await createMember(db, family.familyId, 'viewer');
    const res = await get(
      '/test/family',
      await sessionFor(auth, db, user.id, family.familyId),
    ).expect(200);
    expect(res.body).toEqual({ familyId: family.familyId, userId: user.id });
  });

  it('answers 403 when the active family has no membership', async () => {
    const user = await createMember(db, family.familyId, 'member');
    const other = await createFamily(db);
    await get('/test/family', await sessionFor(auth, db, user.id, other.familyId)).expect(403);
  });

  it('answers 403, not 500, without an active family', async () => {
    const user = await createMember(db, family.familyId, 'member');
    await get('/test/family', await sessionFor(auth, db, user.id, null)).expect(403);
  });

  it('answers 403 after the member is removed, in the same session', async () => {
    const user = await createMember(db, family.familyId, 'member');
    const authorization = await sessionFor(auth, db, user.id, family.familyId);
    await get('/test/family', authorization).expect(200);
    await db.deleteFrom('member').where('userId', '=', user.id).execute();
    await get('/test/family', authorization).expect(403);
  });

  it('is a server error to use @Family() without RequirePermission', async () => {
    const user = await createMember(db, family.familyId, 'member');
    await get('/test/unguarded', await sessionFor(auth, db, user.id, family.familyId)).expect(500);
  });
});
