import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  NotFoundException,
  Param,
} from '@nestjs/common';
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';
import { DATABASE, type Database } from '../../database/index.js';

export const SESSION_NOT_FOUND = 'SESSION_NOT_FOUND';
export const CURRENT_SESSION = 'CURRENT_SESSION';

/** One of the caller's sessions. Never carries the token: with bearer() on, it is a credential. */
export interface SessionView {
  id: string;
  userAgent: string | null;
  ipAddress: string | null;
  createdAt: string;
  updatedAt: string;
  current: boolean;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The caller's own sessions. Our routes rather than Better Auth's `list-sessions` and
 * `revoke-session`: those need a fresh session (younger than a day) and hand every token to
 * the browser. Deleting the row ends the session at once (`cookieCache` is off), for cookie
 * and bearer clients alike.
 */
@Controller('me/sessions')
export class SessionsController {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  @Get()
  async list(@Session() session: UserSession): Promise<SessionView[]> {
    const currentId = session.session.id;
    const rows = await this.db
      .selectFrom('session')
      .select(['id', 'userAgent', 'ipAddress', 'createdAt', 'updatedAt'])
      .where('userId', '=', session.user.id)
      .where('expiresAt', '>', new Date())
      .orderBy('updatedAt', 'desc')
      .execute();
    const views = rows.map((row) => ({
      id: row.id,
      userAgent: row.userAgent,
      ipAddress: row.ipAddress,
      createdAt: new Date(row.createdAt).toISOString(),
      updatedAt: new Date(row.updatedAt).toISOString(),
      current: row.id === currentId,
    }));
    return [...views.filter((v) => v.current), ...views.filter((v) => !v.current)];
  }

  @Delete(':id')
  @HttpCode(204)
  async end(@Session() session: UserSession, @Param('id') id: string): Promise<void> {
    if (id === session.session.id) {
      throw new BadRequestException({ code: CURRENT_SESSION, params: {} });
    }
    const deleted = UUID.test(id)
      ? await this.db
          .deleteFrom('session')
          .where('id', '=', id)
          .where('userId', '=', session.user.id)
          .executeTakeFirst()
      : undefined;
    if (!deleted || deleted.numDeletedRows === 0n) {
      throw new NotFoundException({ code: SESSION_NOT_FOUND, params: {} });
    }
  }

  @Delete()
  @HttpCode(204)
  async endOthers(@Session() session: UserSession): Promise<void> {
    await this.db
      .deleteFrom('session')
      .where('userId', '=', session.user.id)
      .where('id', '!=', session.session.id)
      .execute();
  }
}
