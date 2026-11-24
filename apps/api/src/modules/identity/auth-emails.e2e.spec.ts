import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Database } from '../../database/index.js';
import { latestMailTo } from '../mail/index.js';
import { authEnv } from './auth-env.js';
import type { Auth } from './create-auth.js';
import {
  clientIp,
  createFamily,
  createUser,
  givePassword,
  sessionFor,
  startAuthApp,
  uniqueEmail,
} from './testing.js';

describe('auth emails end to end (Postgres and Mailpit must be up)', () => {
  let app: INestApplication;
  let db: Database;
  let auth: Auth;
  let owner: string;
  let familyId: string;

  beforeAll(async () => {
    ({ app, db, auth } = await startAuthApp());
    const family = await createFamily(db);
    familyId = family.familyId;
    await db.updateTable('user').set({ name: 'Анна' }).where('id', '=', family.ownerId).execute();
    await db
      .updateTable('organization')
      .set({ name: 'Ивановы' })
      .where('id', '=', familyId)
      .execute();
    owner = await sessionFor(auth, db, family.ownerId, familyId);
  });

  afterAll(() => app.close());

  async function invite(locale: string) {
    const email = uniqueEmail(`invitee-${locale}`);
    await request(app.getHttpServer())
      .post('/api/auth/organization/invite-member')
      .set('Authorization', owner)
      .set('x-forwarded-for', clientIp())
      .send({ email, role: 'member', organizationId: familyId, locale })
      .expect(200);
    const row = await db
      .selectFrom('invitation')
      .select('id')
      .where('email', '=', email)
      .executeTakeFirstOrThrow();
    return { email, url: `${authEnv().baseURL}/invite/${row.id}` };
  }

  function requestReset(email: string) {
    return request(app.getHttpServer())
      .post('/api/auth/request-password-reset')
      .set('x-forwarded-for', clientIp())
      .send({ email, redirectTo: '/reset-password' })
      .expect(200);
  }

  it('sends a Russian invitation with the family, the inviter and the link', async () => {
    const { email, url } = await invite('ru');
    const mail = await latestMailTo(email);
    expect(mail.subject).toBe('Приглашение в семью «Ивановы»');
    expect(mail.text).toContain('Анна приглашает вас');
    expect(mail.text).toContain(url);
  });

  it('sends an English invitation when the invitation is in English', async () => {
    const { email } = await invite('en');
    expect((await latestMailTo(email)).subject).toBe('Invitation to the family “Ивановы”');
  });

  it('sends a password reset in the user language', async () => {
    const user = await createUser(db, uniqueEmail('reset'));
    await db.updateTable('user').set({ locale: 'ru' }).where('id', '=', user.id).execute();
    await givePassword(db, user.id);
    await requestReset(user.email);
    const mail = await latestMailTo(user.email);
    expect(mail.subject).toBe('Сброс пароля');
    expect(mail.text).toContain('/reset-password/');
  });

  it('answers a reset for an unknown address the same way and sends nothing', async () => {
    const email = uniqueEmail('nobody');
    await requestReset(email);
    await expect(latestMailTo(email, 1000)).rejects.toThrow(/No email/);
  });
});
