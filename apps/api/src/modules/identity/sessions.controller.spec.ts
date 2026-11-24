import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Database } from '../../database/index.js';
import type { Auth } from './create-auth.js';
import { clientIp, createUser, sessionFor, startAuthApp, uniqueEmail } from './testing.js';

const DAY = 24 * 60 * 60 * 1000;

describe('/me/sessions', () => {
  let app: INestApplication;
  let db: Database;
  let auth: Auth;

  beforeAll(async () => {
    ({ app, db, auth } = await startAuthApp());
  });

  afterAll(() => app.close());

  const http = () => request(app.getHttpServer());
  const list = (bearer: string) =>
    http().get('/me/sessions').set('authorization', bearer).set('x-forwarded-for', clientIp());
  const end = (bearer: string, id: string) =>
    http()
      .delete(`/me/sessions/${id}`)
      .set('authorization', bearer)
      .set('x-forwarded-for', clientIp());
  const endOthers = (bearer: string) =>
    http().delete('/me/sessions').set('authorization', bearer).set('x-forwarded-for', clientIp());
  const me = (bearer: string) =>
    http().get('/me').set('authorization', bearer).set('x-forwarded-for', clientIp());

  async function sessionId(bearer: string) {
    const token = bearer.replace('Bearer ', '');
    const row = await db
      .selectFrom('session')
      .select('id')
      .where('token', '=', token)
      .executeTakeFirstOrThrow();
    return row.id;
  }

  async function userWithSessions(count: number) {
    const user = await createUser(db, uniqueEmail('sessions'));
    const bearers: string[] = [];
    for (let i = 0; i < count; i++) bearers.push(await sessionFor(auth, db, user.id, null));
    return { user, bearers };
  }

  it('lists the caller’s sessions, marks the current one and never returns tokens', async () => {
    const { bearers } = await userWithSessions(2);
    const [a, b] = bearers as [string, string];
    const res = await list(a);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0]).toMatchObject({ id: await sessionId(a), current: true });
    expect(res.body[1]).toMatchObject({ id: await sessionId(b), current: false });
    for (const item of res.body) {
      expect(Object.keys(item).sort()).toEqual(
        ['createdAt', 'current', 'id', 'ipAddress', 'updatedAt', 'userAgent'].sort(),
      );
    }
  });

  it('leaves out expired sessions', async () => {
    const { bearers } = await userWithSessions(2);
    const [a, b] = bearers as [string, string];
    await db
      .updateTable('session')
      .set({ expiresAt: new Date(Date.now() - DAY) })
      .where('id', '=', await sessionId(b))
      .execute();
    const res = await list(a);
    expect(res.body.map((s: { id: string }) => s.id)).toEqual([await sessionId(a)]);
  });

  it('works from a session older than a day', async () => {
    const { bearers } = await userWithSessions(2);
    const [a, b] = bearers as [string, string];
    await db
      .updateTable('session')
      .set({ createdAt: new Date(Date.now() - 2 * DAY) })
      .where('id', '=', await sessionId(a))
      .execute();
    expect((await list(a)).status).toBe(200);
    expect((await end(a, await sessionId(b))).status).toBe(204);
  });

  it('ends another session of the caller', async () => {
    const { bearers } = await userWithSessions(2);
    const [a, b] = bearers as [string, string];
    expect((await me(b)).status).toBe(200);
    expect((await end(a, await sessionId(b))).status).toBe(204);
    expect((await me(b)).status).toBe(401);
    expect((await me(a)).status).toBe(200);
  });

  it('answers SESSION_NOT_FOUND for another user’s session and a malformed id', async () => {
    const mine = await userWithSessions(1);
    const theirs = await userWithSessions(1);
    const foreign = await end(mine.bearers[0]!, await sessionId(theirs.bearers[0]!));
    expect(foreign.status).toBe(404);
    expect(foreign.body).toEqual({ code: 'SESSION_NOT_FOUND', params: {} });
    expect((await me(theirs.bearers[0]!)).status).toBe(200);
    const malformed = await end(mine.bearers[0]!, 'not-a-uuid');
    expect(malformed.status).toBe(404);
    expect(malformed.body).toEqual({ code: 'SESSION_NOT_FOUND', params: {} });
  });

  it('refuses to end the current session', async () => {
    const { bearers } = await userWithSessions(1);
    const res = await end(bearers[0]!, await sessionId(bearers[0]!));
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ code: 'CURRENT_SESSION', params: {} });
    expect((await me(bearers[0]!)).status).toBe(200);
  });

  it('ends all other sessions', async () => {
    const { user, bearers } = await userWithSessions(3);
    const [a, b, c] = bearers as [string, string, string];
    expect((await endOthers(a)).status).toBe(204);
    const left = await db.selectFrom('session').select('id').where('userId', '=', user.id).execute();
    expect(left).toEqual([{ id: await sessionId(a) }]);
    expect((await me(a)).status).toBe(200);
    expect((await me(b)).status).toBe(401);
    expect((await me(c)).status).toBe(401);
  });

  it('needs a session', async () => {
    expect((await http().get('/me/sessions')).status).toBe(401);
    expect((await http().delete('/me/sessions')).status).toBe(401);
    expect((await http().delete('/me/sessions/00000000-0000-7000-8000-000000000000')).status).toBe(
      401,
    );
  });
});
