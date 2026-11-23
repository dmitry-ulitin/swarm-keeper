import { type Kysely, sql } from 'kysely';

// Migrations take Kysely<any>: they are frozen in time and must not follow schema.ts.

/** Trigram matching for search over names and text. */
export async function up(db: Kysely<any>): Promise<void> {
  await sql`create extension if not exists pg_trgm`.execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
  await sql`drop extension if exists pg_trgm`.execute(db);
}
