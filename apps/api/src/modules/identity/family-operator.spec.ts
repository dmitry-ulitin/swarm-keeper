import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Database } from '../../database/index.js';
import { SmtpTransport, latestMailTo, mailEnv } from '../mail/index.js';
import { authEnv } from './auth-env.js';
import type { Auth } from './create-auth.js';
import {
  OperatorError,
  type OperatorDeps,
  createFamilyForOwner,
  listFamilies,
  reinviteFamilyOwner,
} from './family-operator.js';
import { findPendingInvitationById } from './invite-only.js';
import type { InvitationMail, Mailer } from './mailer.js';
import { SmtpMailer } from './smtp-mailer.js';
import {
  addMember,
  clientIp,
  createFamily,
  createUser,
  startAuthApp,
  uniqueEmail,
} from './testing.js';

const PASSWORD = 'correct horse battery';
const DAY_MS = 24 * 60 * 60 * 1000;

class RecordingMailer implements Mailer {
  readonly invitations: InvitationMail[] = [];
  failing = false;

  async invitation(input: InvitationMail) {
    if (this.failing) {
      throw new Error('SMTP down');
    }
    this.invitations.push(input);
  }

  async verifyEmail() {}

  async resetPassword() {}
}

describe('family operator', () => {
  let app: INestApplication;
  let db: Database;
  let auth: Auth;
  let operatorEmail: string;
  let operatorId: string;
  let mailer: RecordingMailer;
  let deps: OperatorDeps;
  const baseURL = authEnv().baseURL;

  beforeAll(async () => {
    ({ app, db, auth } = await startAuthApp());
    const operator = await createUser(db, uniqueEmail('operator'));
    await db.updateTable('user').set({ name: 'Дмитрий' }).where('id', '=', operator.id).execute();
    operatorEmail = operator.email;
    operatorId = operator.id;
    mailer = new RecordingMailer();
    deps = { db, mailer, baseURL };
  });

  afterAll(() => app.close());

  async function familyCount() {
    const row = await db
      .selectFrom('organization')
      .select((eb) => eb.fn.countAll().as('n'))
      .executeTakeFirstOrThrow();
    return Number(row.n);
  }

  function invitationRow(id: string) {
    return db.selectFrom('invitation').selectAll().where('id', '=', id).executeTakeFirstOrThrow();
  }

  async function expectCode(promise: Promise<unknown>, code: string) {
    const error = await promise.then(
      () => undefined,
      (e: unknown) => e,
    );
    expect(error).toBeInstanceOf(OperatorError);
    expect((error as OperatorError).code).toBe(code);
    return error as OperatorError;
  }

  async function sessionToken(userId: string) {
    const ctx = await auth.$context;
    return (await ctx.internalAdapter.createSession(userId)).token;
  }

  it('creates a family with a pending owner invitation and mails it in the requested language', async () => {
    const ownerEmail = uniqueEmail('owner-ru');
    const smtp = new SmtpMailer(new SmtpTransport(mailEnv()));
    const result = await createFamilyForOwner(
      { db, mailer: smtp, baseURL },
      { name: 'Ивановы', ownerEmail, locale: 'ru', operatorEmail },
    );

    const family = await db
      .selectFrom('organization')
      .selectAll()
      .where('id', '=', result.familyId)
      .executeTakeFirstOrThrow();
    expect(family.name).toBe('Ивановы');
    expect(family.slug).toBe(result.slug);
    const members = await db
      .selectFrom('member')
      .select('id')
      .where('organizationId', '=', result.familyId)
      .execute();
    expect(members).toEqual([]);

    const invitation = await invitationRow(result.invitationId);
    expect(invitation).toMatchObject({
      organizationId: result.familyId,
      email: ownerEmail,
      role: 'owner',
      status: 'pending',
      locale: 'ru',
      uiSize: 'compact',
      inviterId: operatorId,
    });
    const expiresIn = new Date(invitation.expiresAt).getTime() - Date.now();
    expect(Math.abs(expiresIn - 7 * DAY_MS)).toBeLessThan(60_000);

    const mail = await latestMailTo(ownerEmail);
    expect(mail.subject).toBe('Приглашение в семью «Ивановы»');
    expect(mail.text).toContain(`${baseURL}/invite/${result.invitationId}`);
  });

  it('defaults the locale to en and names the operator as the inviter', async () => {
    const ownerEmail = uniqueEmail('owner-en');
    const result = await createFamilyForOwner(deps, {
      name: 'The Petrovs',
      ownerEmail,
      operatorEmail,
    });
    expect((await invitationRow(result.invitationId)).locale).toBe('en');
    expect(mailer.invitations.at(-1)).toMatchObject({
      email: ownerEmail,
      url: `${baseURL}/invite/${result.invitationId}`,
      locale: 'en',
      inviterName: 'Дмитрий',
      familyName: 'The Petrovs',
    });
  });

  it('normalizes the owner email', async () => {
    const ownerEmail = uniqueEmail('Mixed-Case');
    const result = await createFamilyForOwner(deps, {
      name: 'The Sidorovs',
      ownerEmail: `  ${ownerEmail.toUpperCase()} `,
      operatorEmail: operatorEmail.toUpperCase(),
    });
    expect((await invitationRow(result.invitationId)).email).toBe(ownerEmail.toLowerCase());
  });

  it('gives a second family with the same name its own slug', async () => {
    const first = await createFamilyForOwner(deps, {
      name: 'The Ivanovs',
      ownerEmail: uniqueEmail('a'),
      operatorEmail,
    });
    const second = await createFamilyForOwner(deps, {
      name: 'The Ivanovs',
      ownerEmail: uniqueEmail('b'),
      operatorEmail,
    });
    expect(first.slug).toMatch(/^the-ivanovs/);
    expect(second.slug).toMatch(/^the-ivanovs-\d+$/);
    expect(second.slug).not.toBe(first.slug);
  });

  it('lets the invitee sign up from the invitation and become the owner', async () => {
    const ownerEmail = uniqueEmail('new-owner');
    const result = await createFamilyForOwner(deps, {
      name: 'The Newcomers',
      ownerEmail,
      operatorEmail,
    });

    await request(app.getHttpServer())
      .post('/api/auth/sign-up/email')
      .set('x-forwarded-for', clientIp())
      .send({
        name: 'Ivan',
        email: ownerEmail,
        password: PASSWORD,
        inviteToken: result.invitationId,
      })
      .expect(200);

    const owner = await db
      .selectFrom('user')
      .innerJoin('member', 'member.userId', 'user.id')
      .select(['user.emailVerified', 'member.role'])
      .where('user.email', '=', ownerEmail)
      .where('member.organizationId', '=', result.familyId)
      .executeTakeFirstOrThrow();
    expect(owner).toEqual({ emailVerified: true, role: 'owner' });
  });

  it('lets an existing member of another family accept and become the owner', async () => {
    const elsewhere = await createFamily(db);
    const person = await db
      .selectFrom('user')
      .select('email')
      .where('id', '=', elsewhere.ownerId)
      .executeTakeFirstOrThrow();
    const result = await createFamilyForOwner(deps, {
      name: 'Second Home',
      ownerEmail: person.email,
      operatorEmail,
    });

    await request(app.getHttpServer())
      .post('/api/auth/organization/accept-invitation')
      .set('Authorization', `Bearer ${await sessionToken(elsewhere.ownerId)}`)
      .set('x-forwarded-for', clientIp())
      .send({ invitationId: result.invitationId })
      .expect(200);

    const roles = await db
      .selectFrom('member')
      .select(['organizationId', 'role'])
      .where('userId', '=', elsewhere.ownerId)
      .execute();
    expect(roles).toEqual(
      expect.arrayContaining([
        { organizationId: elsewhere.familyId, role: 'owner' },
        { organizationId: result.familyId, role: 'owner' },
      ]),
    );
  });

  it('fails without creating anything when the operator is unknown or unverified', async () => {
    const before = await familyCount();
    await expectCode(
      createFamilyForOwner(deps, {
        name: 'Nobody',
        ownerEmail: uniqueEmail('x'),
        operatorEmail: uniqueEmail('ghost'),
      }),
      'OPERATOR_NOT_FOUND',
    );
    const unverified = await createUser(db, uniqueEmail('unverified-operator'), false);
    await expectCode(
      createFamilyForOwner(deps, {
        name: 'Nobody',
        ownerEmail: uniqueEmail('x'),
        operatorEmail: unverified.email,
      }),
      'OPERATOR_UNVERIFIED',
    );
    expect(await familyCount()).toBe(before);
  });

  it('rejects a malformed owner email and an unknown locale', async () => {
    const before = await familyCount();
    await expectCode(
      createFamilyForOwner(deps, { name: 'Bad', ownerEmail: 'not-an-email', operatorEmail }),
      'INVALID_EMAIL',
    );
    await expectCode(
      createFamilyForOwner(deps, {
        name: 'Bad',
        ownerEmail: uniqueEmail('x'),
        locale: 'de',
        operatorEmail,
      }),
      'INVALID_LOCALE',
    );
    expect(await familyCount()).toBe(before);
  });

  it('keeps the family and reports INVITATION_NOT_SENT when the email fails', async () => {
    const ownerEmail = uniqueEmail('unlucky');
    const failing = new RecordingMailer();
    failing.failing = true;
    const error = await expectCode(
      createFamilyForOwner(
        { db, mailer: failing, baseURL },
        { name: 'Unlucky', ownerEmail, operatorEmail },
      ),
      'INVITATION_NOT_SENT',
    );
    const slug = error.params['slug'];
    expect(slug).toMatch(/^unlucky/);

    const pending = await db
      .selectFrom('invitation')
      .innerJoin('organization', 'organization.id', 'invitation.organizationId')
      .select('invitation.id')
      .where('organization.slug', '=', slug!)
      .where('invitation.status', '=', 'pending')
      .execute();
    expect(pending).toHaveLength(1);

    const again = await reinviteFamilyOwner(deps, { familySlug: slug!, operatorEmail });
    expect(again.email).toBe(ownerEmail);
  });

  it('reinvites: cancels older pending owner invitations and reuses their email', async () => {
    const ownerEmail = uniqueEmail('slow');
    const created = await createFamilyForOwner(deps, {
      name: 'Slow Readers',
      ownerEmail,
      operatorEmail,
    });

    const again = await reinviteFamilyOwner(deps, { familySlug: created.slug, operatorEmail });

    expect(again.email).toBe(ownerEmail);
    expect(again.invitationId).not.toBe(created.invitationId);
    expect((await invitationRow(created.invitationId)).status).toBe('canceled');
    expect(await findPendingInvitationById(db, created.invitationId)).toBeUndefined();
    expect(await invitationRow(again.invitationId)).toMatchObject({
      role: 'owner',
      status: 'pending',
      email: ownerEmail,
    });
    expect(mailer.invitations.at(-1)?.url).toBe(`${baseURL}/invite/${again.invitationId}`);
  });

  it('reinvites to another email when one is given', async () => {
    const created = await createFamilyForOwner(deps, {
      name: 'Typo',
      ownerEmail: uniqueEmail('typo'),
      operatorEmail,
    });
    const fixed = uniqueEmail('fixed');
    const again = await reinviteFamilyOwner(deps, {
      familySlug: created.slug,
      ownerEmail: fixed.toUpperCase(),
      operatorEmail,
    });
    expect(again.email).toBe(fixed);
  });

  it('reinvites after the invitation expired', async () => {
    const created = await createFamilyForOwner(deps, {
      name: 'Late',
      ownerEmail: uniqueEmail('late'),
      operatorEmail,
    });
    await db
      .updateTable('invitation')
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where('id', '=', created.invitationId)
      .execute();

    const again = await reinviteFamilyOwner(deps, { familySlug: created.slug, operatorEmail });
    expect(await findPendingInvitationById(db, again.invitationId)).toBeDefined();
  });

  it('refuses to reinvite once the family has an owner', async () => {
    const created = await createFamilyForOwner(deps, {
      name: 'Settled',
      ownerEmail: uniqueEmail('settled'),
      operatorEmail,
    });
    const owner = await createUser(db, uniqueEmail('settled-owner'));
    await addMember(db, created.familyId, owner.id, 'owner');

    await expectCode(
      reinviteFamilyOwner(deps, { familySlug: created.slug, operatorEmail }),
      'FAMILY_HAS_OWNER',
    );
  });

  it('needs an owner email when the family never had an owner invitation', async () => {
    const created = await createFamilyForOwner(deps, {
      name: 'Blank',
      ownerEmail: uniqueEmail('blank'),
      operatorEmail,
    });
    await db.deleteFrom('invitation').where('organizationId', '=', created.familyId).execute();

    await expectCode(
      reinviteFamilyOwner(deps, { familySlug: created.slug, operatorEmail }),
      'OWNER_EMAIL_REQUIRED',
    );
  });

  it('reports FAMILY_NOT_FOUND for an unknown slug', async () => {
    await expectCode(
      reinviteFamilyOwner(deps, { familySlug: 'no-such-family', operatorEmail }),
      'FAMILY_NOT_FOUND',
    );
  });

  it('lists families with owners, member counts and the pending owner invitation', async () => {
    const ownerEmail = uniqueEmail('listed');
    const created = await createFamilyForOwner(deps, {
      name: 'Listed',
      ownerEmail,
      operatorEmail,
    });
    const existing = await createFamily(db);
    const existingOwner = await db
      .selectFrom('user')
      .select('email')
      .where('id', '=', existing.ownerId)
      .executeTakeFirstOrThrow();
    const viewer = await createUser(db, uniqueEmail('viewer'));
    await addMember(db, existing.familyId, viewer.id, 'viewer');

    const families = await listFamilies(db);
    const listed = families.find((f) => f.slug === created.slug);
    expect(listed).toMatchObject({ name: 'Listed', owners: [], members: 0 });
    expect(listed?.pendingOwnerInvitation?.email).toBe(ownerEmail);
    expect(listed?.pendingOwnerInvitation?.expiresAt).toBeInstanceOf(Date);

    const slug = (
      await db
        .selectFrom('organization')
        .select('slug')
        .where('id', '=', existing.familyId)
        .executeTakeFirstOrThrow()
    ).slug;
    expect(families.find((f) => f.slug === slug)).toMatchObject({
      owners: [existingOwner.email],
      members: 2,
      pendingOwnerInvitation: null,
    });
  });
});
