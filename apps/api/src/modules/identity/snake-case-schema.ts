import type { getAuthTables } from 'better-auth/db';

/**
 * Better Auth names tables and columns in camelCase; our database uses snake_case.
 * `database.casing: "snake"` exists in the 1.7.27 types but does nothing (checked 2026-11-23),
 * so the mapping is computed here. Remove this file once `casing` works.
 */

/** `emailVerified` → `email_verified`; an acronym stays one word: `credentialID` → `credential_id`. */
export function toSnakeCase(name: string): string {
  return name
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .toLowerCase();
}

export interface ModelMapping {
  modelName: string;
  fields: Record<string, string>;
}

/** Model key (`user`, `twoFactor`, …) → snake_case table and column names. */
export function snakeCaseSchema(
  tables: ReturnType<typeof getAuthTables>,
): Record<string, ModelMapping> {
  return Object.fromEntries(
    Object.entries(tables).map(([key, table]) => [
      key,
      {
        modelName: toSnakeCase(table.modelName),
        fields: Object.fromEntries(
          Object.keys(table.fields).map((field) => [field, toSnakeCase(field)]),
        ),
      },
    ]),
  );
}
