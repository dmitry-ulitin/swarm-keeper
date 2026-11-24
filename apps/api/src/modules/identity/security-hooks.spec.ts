import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Database } from '../../database/index.js';
import type { Auth } from './create-auth.js';
import {
  clientIp,
  createUser,
  givePassword,
  sessionFor,
  startAuthApp,
  uniqueEmail,
} from './testing.js';

const DAY = 24 * 60 * 60 * 1000;

describe('security hooks', () => {
  let app: INestApplication;
  let db: Database;
  let auth: Auth;

  beforeAll(async () => {
    ({ app, db, auth } = await startAuthApp());
  });

  afterAll(() => app.close());

  async function addPasskey(userId: string, name = 'key') {
    return db
      .insertInto('passkey')
      .values({
        userId,
        name,
        publicKey: 'unused',
        credentialId: `cred-${Math.random().toString(36).slice(2)}`,
        counter: 0,
        deviceType: 'singleDevice',
        backedUp: false,
        createdAt: new Date(),
      })
      .returning('id')
      .executeTakeFirstOrThrow();
  }

  async function signedIn(options: { password?: boolean } = {}) {
    const user = await createUser(db, uniqueEmail('sec'));
    if (options.password) await givePassword(db, user.id);
    const bearer = await sessionFor(auth, db, user.id, null);
    return { user, bearer };
  }

  const deletePasskey = (bearer: string, id: string) =>
    request(app.getHttpServer())
      .post('/api/auth/passkey/delete-passkey')
      .set('authorization', bearer)
      .set('x-forwarded-for', clientIp())
      .send({ id });

  const registerOptions = (bearer: string) =>
    request(app.getHttpServer())
      .get('/api/auth/passkey/generate-register-options')
      .set('authorization', bearer)
      .set('x-forwarded-for', clientIp());

  const passkeysOf = (userId: string) =>
    db.selectFrom('passkey').select('id').where('userId', '=', userId).execute();

  it('refuses to delete the only passkey of a passkey-only account', async () => {
    const { user, bearer } = await signedIn();
    const key = await addPasskey(user.id);
    const res = await deletePasskey(bearer, key.id);
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('LAST_SIGN_IN_METHOD');
    expect(await passkeysOf(user.id)).toHaveLength(1);
  });

  it('deletes the only passkey when the account has a password', async () => {
    const { user, bearer } = await signedIn({ password: true });
    const key = await addPasskey(user.id);
    const res = await deletePasskey(bearer, key.id);
    expect(res.status).toBe(200);
    expect(await passkeysOf(user.id)).toEqual([]);
  });

  it('deletes one of two passkeys, then keeps the last', async () => {
    const { user, bearer } = await signedIn();
    const first = await addPasskey(user.id, 'first');
    const second = await addPasskey(user.id, 'second');
    expect((await deletePasskey(bearer, first.id)).status).toBe(200);
    const last = await deletePasskey(bearer, second.id);
    expect(last.status).toBe(400);
    expect(last.body.code).toBe('LAST_SIGN_IN_METHOD');
    expect(await passkeysOf(user.id)).toEqual([{ id: second.id }]);
  });

  it('refuses passkey registration options to a stale session', async () => {
    const { user, bearer } = await signedIn();
    await db
      .updateTable('session')
      .set({ createdAt: new Date(Date.now() - 2 * DAY) })
      .where('userId', '=', user.id)
      .execute();
    const res = await registerOptions(bearer);
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('SESSION_NOT_FRESH');
  });

  it('gives passkey registration options to a fresh session', async () => {
    const { bearer } = await signedIn();
    expect((await registerOptions(bearer)).status).toBe(200);
  });
});
