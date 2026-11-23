import { createAccessControl } from 'better-auth/plugins/access';
import {
  adminAc,
  defaultStatements,
  memberAc,
  ownerAc,
} from 'better-auth/plugins/organization/access';

/**
 * Everything a family role can be allowed to do: Better Auth's organization
 * statements (organization, member, invitation, ...) plus the archive's own.
 *
 * For `asset` and `album`, `update` and `delete` mean the caller's own records
 * (the service layer checks `owner_id`); `manage` is the right to change other
 * people's items. Private assets stay visible only to their owner whatever the role.
 */
export const statement = {
  ...defaultStatements,
  asset: ['read', 'create', 'update', 'delete', 'manage'],
  album: ['read', 'create', 'update', 'delete', 'manage'],
  archive: ['export', 'purge-trash'],
} as const;

export const ac = createAccessControl(statement);

const allArchiveItems = {
  asset: [...statement.asset],
  album: [...statement.album],
  archive: [...statement.archive],
};

const ownItems = {
  asset: ['read', 'create', 'update', 'delete'],
  album: ['read', 'create', 'update', 'delete'],
} as const;

/** Matrix: docs/architecture/authentication.md, "Roles and permissions". */
export const roles = {
  owner: ac.newRole({ ...ownerAc.statements, ...allArchiveItems }),
  admin: ac.newRole({ ...adminAc.statements, ...allArchiveItems }),
  member: ac.newRole({ ...memberAc.statements, ...ownItems }),
  viewer: ac.newRole({ asset: ['read'], album: ['read'] }),
};

export type FamilyRole = keyof typeof roles;

export const FAMILY_ROLES: readonly FamilyRole[] = ['owner', 'admin', 'member', 'viewer'];

/** Guards role strings read from storage, e.g. `member.role`. */
export function isFamilyRole(value: unknown): value is FamilyRole {
  return typeof value === 'string' && (FAMILY_ROLES as readonly string[]).includes(value);
}
