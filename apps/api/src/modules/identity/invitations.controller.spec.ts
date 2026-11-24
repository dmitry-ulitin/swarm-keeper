import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Database } from '../../database/index.js';
import {
  clientIp,
  createFamily,
  createInvitation,
  createUser,
  startAuthApp,
  uniqueEmail,
} from './testing.js';

describe('GET /api/v1/invitations/:id (anonymous)', () => {
  let app: INestApplication;
  let db: Database;
  let family: { familyId: string; ownerId: string };

  beforeAll(async () => {
    ({ app, db } = await startAuthApp());
    family = await createFamily(db);
    await db
      .updateTable('organization')
      .set({ name: 'Ивановы' })
      .where('id', '=', family.familyId)
      .execute();
    await db.updateTable('user').set({ name: 'Анна' }).where('id', '=', family.ownerId).execute();
  });

  afterAll(() => app.close());

  const get = (id: string) =>
    request(app.getHttpServer()).get(`/invitations/${id}`).set('x-forwarded-for', clientIp());

  const invite = (input: Partial<Parameters<typeof createInvitation>[1]> = {}) =>
    createInvitation(db, {
      familyId: family.familyId,
      inviterId: family.ownerId,
      email: uniqueEmail('invitee'),
      locale: 'ru',
      ...input,
    });

  it('shows a pending invitation without a session', async () => {
    const email = uniqueEmail('valya');
    const { id } = await invite({ email, role: 'member' });
    const res = await get(id).expect(200);
    expect(res.body).toEqual({
      email,
      familyName: 'Ивановы',
      inviterName: 'Анна',
      role: 'member',
      locale: 'ru',
      expiresAt: expect.stringMatching(/^\d{4}-\d\d-\d\dT/),
      hasAccount: false,
    });
  });

  it('knows an existing account whatever the case of the invited email', async () => {
    const lower = uniqueEmail('existing');
    await createUser(db, lower);
    const mixed = lower.replace('existing', 'Existing').replace('example.test', 'Example.test');
    const { id } = await invite({ email: mixed });
    expect((await get(id).expect(200)).body.hasAccount).toBe(true);
  });

  it('normalizes the locale', async () => {
    const { id } = await invite({ locale: 'ru-RU' });
    expect((await get(id).expect(200)).body.locale).toBe('ru');
    const other = await invite({ locale: 'de' });
    expect((await get(other.id).expect(200)).body.locale).toBe('en');
  });

  it.each([
    ['unknown', async () => '0193a000-0000-7000-8000-000000000000'],
    ['not a uuid', async () => 'not-a-uuid'],
    ['expired', async () => (await invite({ expiresAt: new Date(Date.now() - 1000) })).id],
    ['accepted', async () => (await invite({ status: 'accepted' })).id],
    ['canceled', async () => (await invite({ status: 'canceled' })).id],
  ])('answers the same 404 for an %s invitation', async (_label, makeId) => {
    const res = await get(await makeId()).expect(404);
    expect(res.body).toEqual({ code: 'INVITATION_NOT_FOUND', params: {} });
  });
});
