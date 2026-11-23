import { type FamilyRole, roles, statement } from '@swarm-keeper/permissions';

export type Resource = keyof typeof statement;
export type Action<R extends Resource> = (typeof statement)[R][number];

function allows(role: FamilyRole, resource: Resource, action: string): boolean {
  // The statement type is a union per resource; the check itself is plain data.
  return roles[role].authorize({ [resource]: [action] } as never).success;
}

/**
 * An admin action is one the matrix gives to an owner or admin but not to a member.
 * Derived from the roles, so it can never drift from @swarm-keeper/permissions.
 */
export function isAdminAction(resource: Resource, action: string): boolean {
  return (
    (allows('owner', resource, action) || allows('admin', resource, action)) &&
    !allows('member', resource, action)
  );
}

/** Every `resource:action` the role allows, sorted. */
export function permissionsOf(role: FamilyRole): string[] {
  return Object.entries(statement)
    .flatMap(([resource, actions]) =>
      actions
        .filter((action) => allows(role, resource as Resource, action))
        .map((action) => `${resource}:${action}`),
    )
    .sort();
}

/**
 * 2FA is required by account: while someone has a password, it is the weak link,
 * so an owner or admin with a password must have 2FA. Passkey-only accounts are exempt.
 */
export function twoFactorRequired(
  user: { twoFactorEnabled: boolean | null },
  hasPassword: boolean,
): boolean {
  return hasPassword && user.twoFactorEnabled !== true;
}
