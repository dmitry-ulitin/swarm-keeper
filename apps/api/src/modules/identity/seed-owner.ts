import type { Database } from '../../database/index.js';
import type { Auth } from './create-auth.js';

export interface SeedOwnerInput {
  email: string;
  password: string;
  familyName: string;
}

function slugify(name: string): string {
  const slug = name
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'family';
}

/**
 * The first owner and their family, created once at deployment.
 * Writes the rows directly instead of signing up, so the invite-only hook stays strict.
 * Does nothing when a user with this email already exists.
 */
export async function seedOwner(
  auth: Auth,
  db: Database,
  input: SeedOwnerInput,
): Promise<{ created: boolean }> {
  const email = input.email.toLowerCase();
  const existing = await db
    .selectFrom('user')
    .select('id')
    .where('email', '=', email)
    .executeTakeFirst();
  if (existing) {
    return { created: false };
  }

  const ctx = await auth.$context;
  const passwordHash = await ctx.password.hash(input.password);
  const baseSlug = slugify(input.familyName);

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

    const taken = await trx
      .selectFrom('organization')
      .select('slug')
      .where('slug', 'like', `${baseSlug}%`)
      .execute();
    const slugs = new Set(taken.map((row) => row.slug));
    let slug = baseSlug;
    for (let n = 2; slugs.has(slug); n += 1) {
      slug = `${baseSlug}-${n}`;
    }

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
