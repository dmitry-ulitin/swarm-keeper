import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Database } from '../../database/index.js';
import type { Auth } from './create-auth.js';
import {
  addMember,
  clientIp,
  createFamily,
  createMember,
  createUser,
  givePassword,
  sessionFor,
  startAuthApp,
  uniqueEmail,
} from './testing.js';

describe('GET /me', () => {
  let app: INestApplication;
  let db: Database;
  let auth: Auth;

  beforeAll(async () => {
    ({ app, db, auth } = await startAuthApp());
  });

  afterAll(() => app.close());

  function me(authorization: string) {
    return request(app.getHttpServer())
      .get('/me')
      .set('Authorization', authorization)
      .set('x-forwarded-for', clientIp());
  }

  it('describes a viewer: read-only permissions, no 2FA prompt', async () => {
    const { familyId } = await createFamily(db);
    const user = await createMember(db, familyId, 'viewer');
    const res = await me(await sessionFor(auth, db, user.id, familyId)).expect(200);
    expect(res.body).toEqual({
      user: {
        id: user.id,
        name: user.email,
        email: user.email,
        locale: 'en',
        uiSize: 'compact',
        twoFactorEnabled: null,
        hasPassword: false,
      },
      families: [{ id: familyId, name: 'Family', role: 'viewer' }],
      activeFamilyId: familyId,
      role: 'viewer',
      permissions: ['album:read', 'asset:read'],
      twoFactorRequired: false,
    });
  });

  it('tells an owner with a password and no 2FA to set it up', async () => {
    const { familyId } = await createFamily(db);
    const owner = await createMember(db, familyId, 'owner');
    await givePassword(db, owner.id);
    const res = await me(await sessionFor(auth, db, owner.id, familyId)).expect(200);
    expect(res.body.role).toBe('owner');
    expect(res.body.permissions).toContain('organization:delete');
    expect(res.body.twoFactorRequired).toBe(true);
    expect(res.body.user.hasPassword).toBe(true);
  });

  it('does not prompt a member with a password', async () => {
    const { familyId } = await createFamily(db);
    const user = await createMember(db, familyId, 'member');
    await givePassword(db, user.id);
    const res = await me(await sessionFor(auth, db, user.id, familyId)).expect(200);
    expect(res.body.twoFactorRequired).toBe(false);
  });

  it('lists every family with its role', async () => {
    const first = await createFamily(db);
    const second = await createFamily(db);
    const user = await createMember(db, first.familyId, 'member');
    await addMember(db, second.familyId, user.id, 'admin');
    const res = await me(await sessionFor(auth, db, user.id, second.familyId)).expect(200);
    expect(res.body.families).toEqual(
      expect.arrayContaining([
        { id: first.familyId, name: 'Family', role: 'member' },
        { id: second.familyId, name: 'Family', role: 'admin' },
      ]),
    );
    expect(res.body.role).toBe('admin');
  });

  it('answers someone without a family with empty fields', async () => {
    const user = await createUser(db, uniqueEmail('alone'));
    const res = await me(await sessionFor(auth, db, user.id, null)).expect(200);
    expect(res.body).toMatchObject({
      families: [],
      activeFamilyId: null,
      role: null,
      permissions: [],
      twoFactorRequired: false,
    });
  });

  it('ignores an active family the user is not in', async () => {
    const other = await createFamily(db);
    const user = await createUser(db, uniqueEmail('outsider'));
    const res = await me(await sessionFor(auth, db, user.id, other.familyId)).expect(200);
    expect(res.body).toMatchObject({ activeFamilyId: null, role: null, permissions: [] });
  });
});
