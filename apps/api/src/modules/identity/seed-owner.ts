import type { Database } from '../../database/index.js';
import type { Auth } from './create-auth.js';
import { uniqueFamilySlug } from './family-slug.js';

export interface SeedOwnerInput {
  email: string;
  password: string;
  familyName: string;
}

/**
 * The first owner and their family, created once at deployment.
 * Writes the rows directly instead of signing up, so the invite-only hook stays strict.
 * Does nothing once any family exists.
 */
export async function seedOwner(
  auth: Auth,
  db: Database,
  input: SeedOwnerInput,
): Promise<{ created: boolean }> {
  const email = input.email.toLowerCase();
  // Once per installation: any existing family means the seed already ran (perhaps with
  // another email), and a second owner would be one nobody meant to create.
  const family = await db.selectFrom('organization').select('id').limit(1).executeTakeFirst();
  if (family) {
    return { created: false };
  }

  const ctx = await auth.$context;
  const passwordHash = await ctx.password.hash(input.password);

  await db.transaction().execute(async (trx) => {
    const now = new Date();
    const user = await trx
      .insertInto('user')
      .values({ name: email, email, emailVerified: true, locale: 'en', uiSize: 'compact' })
      .returning('id')
      .executeTakeFirstOrThrow();
    await trx
      .insertInto('account')
      .values({
        userId: user.id,
        accountId: user.id,
        providerId: 'credential',
        password: passwordHash,
        updatedAt: now,
      })
      .execute();

    const slug = await uniqueFamilySlug(trx, input.familyName);
    const family = await trx
      .insertInto('organization')
      .values({ name: input.familyName, slug, createdAt: now })
      .returning('id')
      .executeTakeFirstOrThrow();
    await trx
      .insertInto('member')
      .values({ organizationId: family.id, userId: user.id, role: 'owner', createdAt: now })
      .execute();
  });

  return { created: true };
}
