import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  SetMetadata,
  UseGuards,
  applyDecorators,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { MemberHasPermission } from '@thallesp/nestjs-better-auth';
import { DATABASE, type Database } from '../../database/index.js';
import { type Action, type Resource, isAdminAction, twoFactorRequired } from './rules.js';

const ADMIN_ACTION = Symbol('ADMIN_ACTION');

export const TWO_FACTOR_REQUIRED = 'TWO_FACTOR_REQUIRED';

/** Whether the user has a password (credential) account. */
export async function hasPassword(db: Database, userId: string): Promise<boolean> {
  const account = await db
    .selectFrom('account')
    .select('id')
    .where('userId', '=', userId)
    .where('providerId', '=', 'credential')
    .executeTakeFirst();
  return account !== undefined;
}

/**
 * Runs after the global auth guard has checked the session, the active family and the role,
 * so only people allowed to do the admin action get here; it adds the 2FA rule.
 */
@Injectable()
export class TwoFactorGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(DATABASE) private readonly db: Database,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (!this.reflector.get<boolean>(ADMIN_ACTION, context.getHandler())) {
      return true;
    }
    const user = context
      .switchToHttp()
      .getRequest<{ user?: { id: string; twoFactorEnabled?: boolean | null } }>().user;
    if (
      user &&
      twoFactorRequired(
        { twoFactorEnabled: user.twoFactorEnabled ?? null },
        await hasPassword(this.db, user.id),
      )
    ) {
      throw new ForbiddenException({ code: TWO_FACTOR_REQUIRED, params: {} });
    }
    return true;
  }
}

/**
 * The route needs a session, an active family, and a role in it that allows the action.
 * Admin actions (owner/admin only) also need 2FA from anyone who has a password.
 */
export function RequirePermission<R extends Resource>(resource: R, action: Action<R>) {
  return applyDecorators(
    MemberHasPermission({ permissions: { [resource]: [action] } }),
    SetMetadata(ADMIN_ACTION, isAdminAction(resource, action)),
    UseGuards(TwoFactorGuard),
  );
}
