import { type Kysely, sql } from 'kysely';

// Better Auth 1.7.27 tables (core, organization, passkey, twoFactor, rate limit), generated with
// `auth generate` from createAuth's options. Changes: ids default to uuidv7() instead of
// gen_random_uuid(). Names are snake_case through snake-case-schema.ts.

const statements = [
  sql`create table "user" ("id" uuid default uuidv7() not null primary key, "name" text not null, "email" text not null unique, "email_verified" boolean not null, "image" text, "created_at" timestamptz default CURRENT_TIMESTAMP not null, "updated_at" timestamptz default CURRENT_TIMESTAMP not null, "two_factor_enabled" boolean, "locale" text not null, "ui_size" text not null)`,
  sql`create table "session" ("id" uuid default uuidv7() not null primary key, "expires_at" timestamptz not null, "token" text not null unique, "created_at" timestamptz default CURRENT_TIMESTAMP not null, "updated_at" timestamptz not null, "ip_address" text, "user_agent" text, "user_id" uuid not null references "user" ("id") on delete cascade, "active_organization_id" text)`,
  sql`create table "account" ("id" uuid default uuidv7() not null primary key, "account_id" text not null, "provider_id" text not null, "user_id" uuid not null references "user" ("id") on delete cascade, "access_token" text, "refresh_token" text, "id_token" text, "access_token_expires_at" timestamptz, "refresh_token_expires_at" timestamptz, "scope" text, "password" text, "created_at" timestamptz default CURRENT_TIMESTAMP not null, "updated_at" timestamptz not null)`,
  sql`create table "verification" ("id" uuid default uuidv7() not null primary key, "identifier" text not null, "value" text not null, "expires_at" timestamptz not null, "created_at" timestamptz default CURRENT_TIMESTAMP not null, "updated_at" timestamptz default CURRENT_TIMESTAMP not null)`,
  sql`create table "organization" ("id" uuid default uuidv7() not null primary key, "name" text not null, "slug" text not null unique, "logo" text, "created_at" timestamptz not null, "metadata" text)`,
  sql`create table "member" ("id" uuid default uuidv7() not null primary key, "organization_id" uuid not null references "organization" ("id") on delete cascade, "user_id" uuid not null references "user" ("id") on delete cascade, "role" text not null, "created_at" timestamptz not null)`,
  sql`create table "invitation" ("id" uuid default uuidv7() not null primary key, "organization_id" uuid not null references "organization" ("id") on delete cascade, "email" text not null, "role" text, "status" text not null, "expires_at" timestamptz not null, "created_at" timestamptz default CURRENT_TIMESTAMP not null, "inviter_id" uuid not null references "user" ("id") on delete cascade, "locale" text, "ui_size" text)`,
  sql`create table "passkey" ("id" uuid default uuidv7() not null primary key, "name" text, "public_key" text not null, "user_id" uuid not null references "user" ("id") on delete cascade, "credential_id" text not null, "counter" integer not null, "device_type" text not null, "backed_up" boolean not null, "transports" text, "created_at" timestamptz, "aaguid" text)`,
  sql`create table "two_factor" ("id" uuid default uuidv7() not null primary key, "secret" text not null, "backup_codes" text not null, "user_id" uuid not null references "user" ("id") on delete cascade, "verified" boolean, "failed_verification_count" integer, "locked_until" timestamptz)`,
  sql`create table "rate_limit" ("id" uuid default uuidv7() not null primary key, "key" text not null unique, "count" integer not null, "last_request" bigint not null)`,
  sql`create index "session_user_id_idx" on "session" ("user_id")`,
  sql`create index "account_user_id_idx" on "account" ("user_id")`,
  sql`create index "verification_identifier_idx" on "verification" ("identifier")`,
  sql`create index "member_organization_id_idx" on "member" ("organization_id")`,
  sql`create index "member_user_id_idx" on "member" ("user_id")`,
  sql`create index "invitation_organization_id_idx" on "invitation" ("organization_id")`,
  sql`create index "invitation_email_idx" on "invitation" ("email")`,
  sql`create index "passkey_user_id_idx" on "passkey" ("user_id")`,
  sql`create index "passkey_credential_id_idx" on "passkey" ("credential_id")`,
  sql`create index "two_factor_secret_idx" on "two_factor" ("secret")`,
  sql`create index "two_factor_user_id_idx" on "two_factor" ("user_id")`,
];

export async function up(db: Kysely<any>): Promise<void> {
  for (const statement of statements) {
    await statement.execute(db);
  }
}

export async function down(db: Kysely<any>): Promise<void> {
  // Reverse dependency order; indexes go with their tables.
  for (const table of [
    'rate_limit',
    'two_factor',
    'passkey',
    'invitation',
    'member',
    'organization',
    'verification',
    'account',
    'session',
    'user',
  ]) {
    await sql`drop table if exists ${sql.id(table)}`.execute(db);
  }
}
