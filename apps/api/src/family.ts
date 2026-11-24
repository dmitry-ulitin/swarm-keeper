// pnpm family:create | family:invite-owner | family:list — the operator's commands.
// Sends real invitation emails over SMTP (SMTP_URL, MAIL_FROM).
import { createDatabase, databaseUrl } from './database/index.js';
import { type FamilyCommand, UsageError, parseFamilyCommand } from './family-command.js';
import {
  OperatorError,
  SmtpMailer,
  authEnv,
  createFamilyForOwner,
  listFamilies,
  reinviteFamilyOwner,
} from './modules/identity/index.js';
import { SmtpTransport, mailEnv } from './modules/mail/index.js';

const HINTS: Partial<Record<OperatorError['code'], (params: Record<string, string>) => string>> = {
  OPERATOR_NOT_FOUND: (p) => `no account with the inviter email ${p['email']}`,
  OPERATOR_UNVERIFIED: (p) => `the inviter ${p['email']} has not verified their email`,
  INVALID_EMAIL: (p) => `not an email address: ${p['email']}`,
  INVALID_LOCALE: (p) => `unknown locale ${p['locale']}; use en or ru`,
  FAMILY_NOT_FOUND: (p) => `no family with the slug ${p['slug']} (see pnpm family:list)`,
  FAMILY_HAS_OWNER: (p) => `${p['slug']} already has an owner; they invite people themselves`,
  OWNER_EMAIL_REQUIRED: () => 'the family has no owner invitation yet; pass --owner-email',
  INVITATION_NOT_SENT: (p) =>
    `the family exists but the email failed; run pnpm family:invite-owner --family ${p['slug']}`,
};

async function run(command: FamilyCommand): Promise<void> {
  const db = createDatabase(databaseUrl());
  try {
    if (command.kind === 'list') {
      const families = await listFamilies(db);
      console.table(
        families.map((f) => ({
          slug: f.slug,
          name: f.name,
          owners: f.owners.join(', '),
          members: f.members,
          'pending owner invitation': f.pendingOwnerInvitation
            ? `${f.pendingOwnerInvitation.email} until ${f.pendingOwnerInvitation.expiresAt.toISOString()}`
            : '',
        })),
      );
      return;
    }
    const deps = {
      db,
      mailer: new SmtpMailer(new SmtpTransport(mailEnv())),
      baseURL: authEnv().baseURL,
    };
    if (command.kind === 'create') {
      const created = await createFamilyForOwner(deps, command);
      console.log(
        `Created family "${command.name}" (${created.slug}); invitation sent to ${command.ownerEmail.trim().toLowerCase()}`,
      );
      return;
    }
    const sent = await reinviteFamilyOwner(deps, command);
    console.log(`Owner invitation for ${command.familySlug} sent to ${sent.email}`);
  } finally {
    await db.destroy();
  }
}

try {
  await run(parseFamilyCommand(process.argv.slice(2), process.env));
} catch (error) {
  if (error instanceof UsageError) {
    console.error(error.message);
    process.exitCode = 2;
  } else if (error instanceof OperatorError) {
    console.error(`${error.code}: ${HINTS[error.code]?.(error.params) ?? ''}`);
    process.exitCode = 1;
  } else {
    throw error;
  }
}
