import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Database } from '../../database/index.js';
import type { Mailer } from './mailer.js';
import { clientIp, createUser, givePassword, startAuthApp, uniqueEmail } from './testing.js';

/** Never delivers: stands in for a slow or hanging SMTP server. */
const never = () => new Promise<void>(() => {});
const hangingMailer: Mailer = { invitation: never, verifyEmail: never, resetPassword: never };

describe('auth emails do not hold up account-revealing responses', () => {
  let app: INestApplication;
  let db: Database;

  beforeAll(async () => {
    ({ app, db } = await startAuthApp([], { mailer: hangingMailer }));
  });

  afterAll(() => app.close());

  it('answers a password reset for a real account without waiting for the email', async () => {
    const user = await createUser(db, uniqueEmail('slow-reset'));
    await givePassword(db, user.id);
    const res = await request(app.getHttpServer())
      .post('/api/auth/request-password-reset')
      .set('x-forwarded-for', clientIp())
      .timeout(2000)
      .send({ email: user.email, redirectTo: '/reset-password' });
    expect(res.status).toBe(200);
  });

  it('answers a verification request without waiting for the email', async () => {
    const user = await createUser(db, uniqueEmail('slow-verify'), false);
    const res = await request(app.getHttpServer())
      .post('/api/auth/send-verification-email')
      .set('x-forwarded-for', clientIp())
      .timeout(2000)
      .send({ email: user.email });
    expect(res.status).toBe(200);
  });
});
