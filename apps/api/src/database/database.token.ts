import type { Kysely } from 'kysely';
import type { DB } from './schema.js';

/** Injection token for the Kysely instance: `@Inject(DATABASE) db: Database`. */
export const DATABASE = Symbol('DATABASE');

export type Database = Kysely<DB>;
