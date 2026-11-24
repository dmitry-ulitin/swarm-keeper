import { Controller, type INestApplication, Post } from '@nestjs/common';
import { sql } from 'kysely';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Database } from '../../database/index.js';
import type { Auth } from './create-auth.js';
import { RequirePermission } from './require-permission.js';
import {
  clientIp,
  createFamily,
  createInvitation,
  createUser,
  sessionFor,
  startAuthApp,
  uniqueEmail,
} from './testing.js';
import { registerWithPasskey } from './testing-webauthn.js';

@Controller('test/purge')
class PurgeController {
  @Post()
  @RequirePermission('archive', 'purge-trash')
  purge() {
    return { ok: true };
  }
}

describe('passkey-first sign-up from an invitation', () => {
  let app: INestApplication;
  let db: Database;
  let auth: Auth;
  let family: { familyId: string; ownerId: string };

  beforeAll(async () => {
    ({ app, db, auth } = await startAuthApp([PurgeController]));
    family = await createFamily(db);
  });

  afterAll(() => app.close());

  const invite = (input: Partial<Parameters<typeof createInvitation>[1]> = {}) =>
    createInvitation(db, {
      familyId: family.familyId,
      inviterId: family.ownerId,
      email: uniqueEmail('passkey'),
      ...input,
    });

  const userByEmail = (email: string) =>
    db
      .selectFrom('user')
      .selectAll()
      .where((eb) => eb(eb.fn('lower', ['email']), '=', email.toLowerCase()))
      .execute();

  it('creates a verified member with a passkey, no password and a session', async () => {
    const email = uniqueEmail('valya');
    const invitation = await invite({ email, role: 'admin', locale: 'en' });
    const { verified, token } = await registerWithPasskey(app, {
      invitation: invitation.id,
      name: 'Бабушка Валя',
      locale: 'ru',
    });
    expect(verified?.status).toBe(200);
    expect(token).toBeTruthy();

    const [user] = await userByEmail(email);
    expect(user).toMatchObject({ emailVerified: true, locale: 'ru', name: 'Бабушка Валя' });
    const members = await db
      .selectFrom('member')
      .selectAll()
      .where('userId', '=', user!.id)
      .execute();
    expect(members).toEqual([
      expect.objectContaining({ organizationId: family.familyId, role: 'admin' }),
    ]);
    const row = await db
      .selectFrom('invitation')
      .select('status')
      .where('id', '=', invitation.id)
      .executeTakeFirst();
    expect(row?.status).toBe('accepted');
    const credential = await db
      .selectFrom('account')
      .select('id')
      .where('userId', '=', user!.id)
      .where('providerId', '=', 'credential')
      .execute();
    expect(credential).toEqual([]);
    const passkeys = await db
      .selectFrom('passkey')
      .select('id')
      .where('userId', '=', user!.id)
      .execute();
    expect(passkeys).toHaveLength(1);

    const bearer = `Bearer ${token}`;
    const me = await request(app.getHttpServer())
      .get('/me')
      .set('Authorization', bearer)
      .expect(200);
    expect(me.body.activeFamilyId).toBe(family.familyId);
    expect(me.body.twoFactorRequired).toBe(false);
    await request(app.getHttpServer())
      .post('/test/purge')
      .set('Authorization', bearer)
      .set('x-forwarded-for', clientIp())
      .expect(201);
  });

  it('accepts an invitation email in mixed case', async () => {
    const email = uniqueEmail('mixed')
      .replace('mixed', 'Mixed')
      .replace('example.test', 'Example.test');
    const invitation = await invite({ email });
    const { verified } = await registerWithPasskey(app, {
      invitation: invitation.id,
      name: 'Пётр',
    });
    expect(verified?.status).toBe(200);
    expect(await userByEmail(email)).toHaveLength(1);
  });

  it.each([
    [
      'an unknown invitation',
      async () => ({ invitation: '0193a000-0000-7000-8000-000000000000', name: 'X' }),
    ],
    [
      'an expired invitation',
      async () => ({
        invitation: (await invite({ expiresAt: new Date(Date.now() - 1000) })).id,
        name: 'X',
      }),
    ],
    [
      'an email that already has an account',
      async () => {
        const email = uniqueEmail('taken');
        await createUser(db, email);
        return { invitation: (await invite({ email })).id, name: 'X' };
      },
    ],
    ['no context', async () => undefined],
    ['a context that is not JSON', async () => 'not json'],
  ])('rejects %s with INVITE_REQUIRED and creates no user', async (_label, makeContext) => {
    const context = await makeContext();
    const before = await db
      .selectFrom('user')
      .select(db.fn.countAll().as('n'))
      .executeTakeFirstOrThrow();
    const { generated } = await registerWithPasskey(app, context);
    expect(generated.status).toBe(400);
    expect(generated.body.code).toBe('INVITE_REQUIRED');
    const after = await db
      .selectFrom('user')
      .select(db.fn.countAll().as('n'))
      .executeTakeFirstOrThrow();
    expect(after.n).toBe(before.n);
  });

  it('rejects an empty name with NAME_REQUIRED', async () => {
    const invitation = await invite();
    const { generated } = await registerWithPasskey(app, {
      invitation: invitation.id,
      name: '   ',
    });
    expect(generated.status).toBe(400);
    expect(generated.body.code).toBe('NAME_REQUIRED');
  });

  it('creates one user when the same invitation is verified twice', async () => {
    const email = uniqueEmail('twice');
    const invitation = await invite({ email });
    const context = { invitation: invitation.id, name: 'Дважды' };
    const [first, second] = await Promise.all([
      registerWithPasskey(app, context),
      registerWithPasskey(app, context),
    ]);
    const statuses = [
      first.verified?.status ?? first.generated.status,
      second.verified?.status ?? second.generated.status,
    ];
    expect(statuses.filter((s) => s === 200)).toHaveLength(1);
    const users = await userByEmail(email);
    expect(users).toHaveLength(1);
    const members = await db
      .selectFrom('member')
      .select('id')
      .where('userId', '=', users[0]!.id)
      .execute();
    expect(members).toHaveLength(1);
  });

  it('leaves nothing behind when the passkey cannot be stored', async () => {
    // A trigger makes the passkey insert fail after the user and membership are written.
    await sql`create or replace function fail_test_passkey() returns trigger language plpgsql as $$
      begin if new.name = 'fail-on-insert' then raise exception 'test failure'; end if; return new; end $$`.execute(
      db,
    );
    await sql`create trigger fail_test_passkey before insert on passkey for each row execute function fail_test_passkey()`.execute(
      db,
    );
    try {
      const email = uniqueEmail('atomic');
      const invitation = await invite({ email });
      const { verified } = await registerWithPasskey(
        app,
        { invitation: invitation.id, name: 'Атомарно' },
        { passkeyName: 'fail-on-insert' },
      );
      expect(verified?.status).toBeGreaterThanOrEqual(400);
      expect(await userByEmail(email)).toEqual([]);
      const row = await db
        .selectFrom('invitation')
        .select('status')
        .where('id', '=', invitation.id)
        .executeTakeFirst();
      expect(row?.status).toBe('pending');
    } finally {
      await sql`drop trigger if exists fail_test_passkey on passkey`.execute(db);
      await sql`drop function if exists fail_test_passkey()`.execute(db);
    }
  });

  it('refuses a passkey from a session that is not fresh', async () => {
    const user = await createUser(db, uniqueEmail('stale'));
    const bearer = await sessionFor(auth, db, user.id, null);
    await db
      .updateTable('session')
      .set({ createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) })
      .where('userId', '=', user.id)
      .execute();
    const { generated, verified } = await registerWithPasskey(app, undefined, {
      bearer,
      createSession: false,
    });
    const status = verified?.status ?? generated.status;
    expect(status).toBe(403);
    expect((verified ?? generated).body.code).toBe('SESSION_NOT_FRESH');
    const passkeys = await db
      .selectFrom('passkey')
      .select('id')
      .where('userId', '=', user.id)
      .execute();
    expect(passkeys).toEqual([]);
  });

  it('lets a signed-in user add a passkey for themselves', async () => {
    const user = await createUser(db, uniqueEmail('self'));
    const bearer = await sessionFor(auth, db, user.id, null);
    const before = await db
      .selectFrom('user')
      .select(db.fn.countAll().as('n'))
      .executeTakeFirstOrThrow();
    const { verified } = await registerWithPasskey(app, undefined, {
      bearer,
      createSession: false,
    });
    expect(verified?.status).toBe(200);
    const passkeys = await db
      .selectFrom('passkey')
      .select('userId')
      .where('userId', '=', user.id)
      .execute();
    expect(passkeys).toHaveLength(1);
    const after = await db
      .selectFrom('user')
      .select(db.fn.countAll().as('n'))
      .executeTakeFirstOrThrow();
    expect(after.n).toBe(before.n);
  });
});

describe('password sign-up takes the visitor language', () => {
  let app: INestApplication;
  let db: Database;
  let family: { familyId: string; ownerId: string };

  beforeAll(async () => {
    ({ app, db } = await startAuthApp());
    family = await createFamily(db);
  });

  afterAll(() => app.close());

  it.each([
    ['ru', 'ru'],
    ['de', 'en'],
  ])('body locale %s on an en invitation → %s', async (locale, expected) => {
    const email = uniqueEmail(`pw-${locale}`);
    const invitation = await createInvitation(db, {
      familyId: family.familyId,
      inviterId: family.ownerId,
      email,
      locale: 'en',
    });
    await request(app.getHttpServer())
      .post('/api/auth/sign-up/email')
      .set('x-forwarded-for', clientIp())
      .send({
        name: 'P',
        email,
        password: 'correct horse battery',
        inviteToken: invitation.id,
        locale,
      })
      .expect(200);
    const user = await db
      .selectFrom('user')
      .select('locale')
      .where('email', '=', email)
      .executeTakeFirst();
    expect(user?.locale).toBe(expected);
  });
});
