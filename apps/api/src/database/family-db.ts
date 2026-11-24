import { Inject, Injectable } from '@nestjs/common';
import { type Transaction, sql } from 'kysely';
import { DATABASE, type Database } from './database.token.js';
import type { DB } from './schema.js';

/** Who is acting and in which family: from the verified membership row, never from the client. */
export interface FamilyContext {
  familyId: string;
  userId: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Family work runs in `run`: one transaction with app.family_id and app.user_id set locally, which
 * the family_isolation policy reads. The settings end with the transaction, so a pooled connection
 * carries nothing to the next caller. Not nestable: code inside passes `trx` along.
 */
@Injectable()
export class FamilyDb {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async run<T>(ctx: FamilyContext, fn: (trx: Transaction<DB>) => Promise<T>): Promise<T> {
    for (const [name, value] of Object.entries(ctx)) {
      if (!UUID.test(value)) {
        throw new Error(`FamilyContext.${name} is not a UUID`);
      }
    }
    return this.db.transaction().execute(async (trx) => {
      // set_config(..., true) is SET LOCAL with parameters.
      await sql`select set_config('app.family_id', ${ctx.familyId}, true), set_config('app.user_id', ${ctx.userId}, true)`.execute(
        trx,
      );
      return fn(trx);
    });
  }
}
