// What the operator (the person running the installation) does from the command line:
// create a family, invite or reinvite its owner, list families. The CLI is a thin layer
// over these functions, so a later web panel or self-service sign-up can reuse them.
import type { Transaction } from 'kysely';
import type { DB, Database } from '../../database/index.js';
import { INVITATION_EXPIRES_IN } from './create-auth.js';
import { uniqueFamilySlug } from './family-slug.js';
import type { Mailer } from './mailer.js';

export type OperatorErrorCode =
  | 'OPERATOR_NOT_FOUND'
  | 'OPERATOR_UNVERIFIED'
  | 'INVALID_EMAIL'
  | 'INVALID_LOCALE'
  | 'FAMILY_NOT_FOUND'
  | 'FAMILY_HAS_OWNER'
  | 'OWNER_EMAIL_REQUIRED'
  | 'INVITATION_NOT_SENT';

export class OperatorError extends Error {
  constructor(
    readonly code: OperatorErrorCode,
    readonly params: Record<string, string> = {},
    options?: { cause?: unknown },
  ) {
    super(code, options);
    this.name = 'OperatorError';
  }
}

export interface OperatorDeps {
  db: Database;
  mailer: Mailer;
  /** Public origin of the web app; invitation links are `${baseURL}/invite/<id>`. */
  baseURL: string;
}

export interface FamilySummary {
  slug: string;
  name: string;
  owners: string[];
  members: number;
  pendingOwnerInvitation: { email: string; expiresAt: Date } | null;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const LOCALES = new Set(['en', 'ru']);

function normalizeEmail(email: string): string {
  const normalized = email.trim().toLowerCase();
  if (!EMAIL.test(normalized)) {
    throw new OperatorError('INVALID_EMAIL', { email });
  }
  return normalized;
}

/** The inviter: the operator's own account, which must have a verified email. */
async function findOperator(db: Database, email: string) {
  const operator = await db
    .selectFrom('user')
    .select(['id', 'name', 'emailVerified'])
    .where((eb) => eb(eb.fn('lower', ['email']), '=', email.trim().toLowerCase()))
    .executeTakeFirst();
  if (!operator) {
    throw new OperatorError('OPERATOR_NOT_FOUND', { email });
  }
  if (!operator.emailVerified) {
    throw new OperatorError('OPERATOR_UNVERIFIED', { email });
  }
  return operator;
}

async function insertOwnerInvitation(
  trx: Transaction<DB>,
  input: { familyId: string; inviterId: string; email: string; locale: string },
) {
  const expiresAt = new Date(Date.now() + INVITATION_EXPIRES_IN * 1000);
  const row = await trx
    .insertInto('invitation')
    .values({
      organizationId: input.familyId,
      inviterId: input.inviterId,
      email: input.email,
      role: 'owner',
      status: 'pending',
      expiresAt,
      locale: input.locale,
      uiSize: 'compact',
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  return { id: row.id, expiresAt };
}

async function sendOwnerInvitation(
  deps: OperatorDeps,
  input: {
    invitationId: string;
    email: string;
    locale: string;
    inviterName: string;
    familyName: string;
    slug: string;
    expiresAt: Date;
  },
) {
  try {
    await deps.mailer.invitation({
      email: input.email,
      url: `${deps.baseURL}/invite/${input.invitationId}`,
      locale: input.locale,
      inviterName: input.inviterName,
      familyName: input.familyName,
      expiresAt: input.expiresAt,
    });
  } catch (cause) {
    throw new OperatorError('INVITATION_NOT_SENT', { slug: input.slug }, { cause });
  }
}

/**
 * A new family with no members and a pending owner invitation, mailed to `ownerEmail`.
 * The rows are committed before the email goes out: when sending fails, the family stays
 * and `INVITATION_NOT_SENT` tells the operator to reinvite.
 */
export async function createFamilyForOwner(
  deps: OperatorDeps,
  input: { name: string; ownerEmail: string; locale?: string; operatorEmail: string },
): Promise<{ familyId: string; slug: string; invitationId: string }> {
  const email = normalizeEmail(input.ownerEmail);
  const locale = input.locale ?? 'en';
  if (!LOCALES.has(locale)) {
    throw new OperatorError('INVALID_LOCALE', { locale });
  }
  const operator = await findOperator(deps.db, input.operatorEmail);

  const created = await deps.db.transaction().execute(async (trx) => {
    const slug = await uniqueFamilySlug(trx, input.name);
    const family = await trx
      .insertInto('organization')
      .values({ name: input.name, slug, createdAt: new Date() })
      .returning('id')
      .executeTakeFirstOrThrow();
    const invitation = await insertOwnerInvitation(trx, {
      familyId: family.id,
      inviterId: operator.id,
      email,
      locale,
    });
    return { familyId: family.id, slug, invitation };
  });

  await sendOwnerInvitation(deps, {
    invitationId: created.invitation.id,
    email,
    locale,
    inviterName: operator.name,
    familyName: input.name,
    slug: created.slug,
    expiresAt: created.invitation.expiresAt,
  });
  return { familyId: created.familyId, slug: created.slug, invitationId: created.invitation.id };
}

/**
 * A fresh owner invitation for a family that has no owner yet; earlier pending owner
 * invitations are canceled, so their links stop working. Without `ownerEmail` it reuses
 * the email of the family's latest owner invitation.
 */
export async function reinviteFamilyOwner(
  deps: OperatorDeps,
  input: { familySlug: string; ownerEmail?: string; operatorEmail: string },
): Promise<{ invitationId: string; email: string }> {
  const given = input.ownerEmail === undefined ? undefined : normalizeEmail(input.ownerEmail);
  const operator = await findOperator(deps.db, input.operatorEmail);

  const family = await deps.db
    .selectFrom('organization')
    .select(['id', 'name', 'slug'])
    .where('slug', '=', input.familySlug)
    .executeTakeFirst();
  if (!family) {
    throw new OperatorError('FAMILY_NOT_FOUND', { slug: input.familySlug });
  }

  const created = await deps.db.transaction().execute(async (trx) => {
    const owner = await trx
      .selectFrom('member')
      .select('id')
      .where('organizationId', '=', family.id)
      .where('role', '=', 'owner')
      .executeTakeFirst();
    if (owner) {
      throw new OperatorError('FAMILY_HAS_OWNER', { slug: family.slug });
    }
    const latest = await trx
      .selectFrom('invitation')
      .select(['email', 'locale'])
      .where('organizationId', '=', family.id)
      .where('role', '=', 'owner')
      .orderBy('createdAt', 'desc')
      .orderBy('id', 'desc')
      .executeTakeFirst();
    const email = given ?? latest?.email;
    if (!email) {
      throw new OperatorError('OWNER_EMAIL_REQUIRED', { slug: family.slug });
    }
    const locale = latest?.locale && LOCALES.has(latest.locale) ? latest.locale : 'en';

    await trx
      .updateTable('invitation')
      .set({ status: 'canceled' })
      .where('organizationId', '=', family.id)
      .where('role', '=', 'owner')
      .where('status', '=', 'pending')
      .execute();
    const invitation = await insertOwnerInvitation(trx, {
      familyId: family.id,
      inviterId: operator.id,
      email,
      locale,
    });
    return { email, locale, invitation };
  });

  await sendOwnerInvitation(deps, {
    invitationId: created.invitation.id,
    email: created.email,
    locale: created.locale,
    inviterName: operator.name,
    familyName: family.name,
    slug: family.slug,
    expiresAt: created.invitation.expiresAt,
  });
  return { invitationId: created.invitation.id, email: created.email };
}

/** Every family on the installation, oldest first. */
export async function listFamilies(db: Database): Promise<FamilySummary[]> {
  const families = await db
    .selectFrom('organization')
    .select(['id', 'slug', 'name'])
    .orderBy('createdAt')
    .orderBy('id')
    .execute();
  const members = await db
    .selectFrom('member')
    .innerJoin('user', 'user.id', 'member.userId')
    .select(['member.organizationId', 'member.role', 'user.email'])
    .orderBy('user.email')
    .execute();
  const invitations = await db
    .selectFrom('invitation')
    .select(['organizationId', 'email', 'expiresAt'])
    .where('role', '=', 'owner')
    .where('status', '=', 'pending')
    .where('expiresAt', '>', new Date())
    .orderBy('createdAt', 'desc')
    .execute();

  return families.map((family) => {
    const own = members.filter((m) => m.organizationId === family.id);
    const invitation = invitations.find((i) => i.organizationId === family.id);
    return {
      slug: family.slug,
      name: family.name,
      owners: own.filter((m) => m.role === 'owner').map((m) => m.email),
      members: own.length,
      pendingOwnerInvitation: invitation
        ? { email: invitation.email, expiresAt: new Date(invitation.expiresAt) }
        : null,
    };
  });
}
