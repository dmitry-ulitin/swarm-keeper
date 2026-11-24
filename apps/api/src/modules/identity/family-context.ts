import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  InternalServerErrorException,
  createParamDecorator,
} from '@nestjs/common';
import { DATABASE, type Database, type FamilyContext } from '../../database/index.js';

interface FamilyRequest {
  user?: { id: string } | null;
  session?: { session?: { activeOrganizationId?: string | null } } | null;
  familyContext?: FamilyContext;
}

/**
 * Turns the session into a FamilyContext from the member row for the session's user and active
 * family; without that row the request is forbidden. RLS reads only this context, never
 * session.activeOrganizationId on its own. Added to every route by RequirePermission.
 */
@Injectable()
export class FamilyContextGuard implements CanActivate {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<FamilyRequest>();
    const userId = request.user?.id;
    const familyId = request.session?.session?.activeOrganizationId;
    if (!userId || !familyId) {
      throw new ForbiddenException();
    }
    const member = await this.db
      .selectFrom('member')
      .select(['organizationId', 'userId'])
      .where('userId', '=', userId)
      .where('organizationId', '=', familyId)
      .executeTakeFirst();
    if (!member) {
      throw new ForbiddenException();
    }
    request.familyContext = { familyId: member.organizationId, userId: member.userId };
    return true;
  }
}

/** The verified FamilyContext of a @RequirePermission route, for FamilyDb.run. */
export const Family = createParamDecorator((_data: unknown, context: ExecutionContext) => {
  const ctx = context.switchToHttp().getRequest<FamilyRequest>().familyContext;
  if (!ctx) {
    // A programming error: the route has no @RequirePermission.
    throw new InternalServerErrorException();
  }
  return ctx;
});
