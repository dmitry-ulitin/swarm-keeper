import type { Kysely, Transaction } from 'kysely';
import type { DB } from '../../database/index.js';

function slugify(name: string): string {
  const slug = name
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'family';
}

/** A slug for a new family that no other family has: `the-ivanovs`, then `the-ivanovs-2`… */
export async function uniqueFamilySlug(
  db: Kysely<DB> | Transaction<DB>,
  name: string,
): Promise<string> {
  const baseSlug = slugify(name);
  const taken = await db
    .selectFrom('organization')
    .select('slug')
    .where('slug', 'like', `${baseSlug}%`)
    .execute();
  const slugs = new Set(taken.map((row) => row.slug));
  let slug = baseSlug;
  for (let n = 2; slugs.has(slug); n += 1) {
    slug = `${baseSlug}-${n}`;
  }
  return slug;
}
