import type { Kysely, Transaction } from 'kysely';
import type { DB } from '../../database/index.js';

// Russian letters in Latin, as in passports (ICAO 9303, with ё → e and ь, ъ dropped).
const CYRILLIC: Record<string, string> = {
  а: 'a',
  б: 'b',
  в: 'v',
  г: 'g',
  д: 'd',
  е: 'e',
  ё: 'e',
  ж: 'zh',
  з: 'z',
  и: 'i',
  й: 'y',
  к: 'k',
  л: 'l',
  м: 'm',
  н: 'n',
  о: 'o',
  п: 'p',
  р: 'r',
  с: 's',
  т: 't',
  у: 'u',
  ф: 'f',
  х: 'kh',
  ц: 'ts',
  ч: 'ch',
  ш: 'sh',
  щ: 'shch',
  ъ: '',
  ы: 'y',
  ь: '',
  э: 'e',
  ю: 'yu',
  я: 'ya',
};

/** `Семья Щукиных` → `semya-shchukinykh`; a name with no usable letters becomes `family`. */
export function slugify(name: string): string {
  const slug = name
    .normalize('NFC')
    .toLowerCase()
    .replace(/[а-яё]/g, (letter) => CYRILLIC[letter] ?? '')
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
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
