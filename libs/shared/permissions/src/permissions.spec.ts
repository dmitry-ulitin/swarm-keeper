import { describe, expect, it } from 'vitest';
import { FAMILY_ROLES, type FamilyRole, isFamilyRole, roles } from './permissions.js';

type Allowed = Record<FamilyRole, boolean>;
const everyone: Allowed = { owner: true, admin: true, member: true, viewer: true };
const contributors: Allowed = { owner: true, admin: true, member: true, viewer: false };
const managers: Allowed = { owner: true, admin: true, member: false, viewer: false };
const ownerOnly: Allowed = { owner: true, admin: false, member: false, viewer: false };

// The role matrix from docs/architecture/authentication.md ("Roles and permissions"),
// mapped to statements in docs/superpowers/specs/2026-11-23-permissions-design.md.
const matrix: [row: string, request: Record<string, string[]>, allowed: Allowed][] = [
  ['view shared photos and documents', { asset: ['read'], album: ['read'] }, everyone],
  ['upload, create albums', { asset: ['create'], album: ['create'] }, contributors],
  [
    'edit and delete own items',
    { asset: ['update', 'delete'], album: ['update', 'delete'] },
    contributors,
  ],
  ["edit and delete others' shared items", { asset: ['manage'], album: ['manage'] }, managers],
  [
    'invite and remove members, change roles',
    { member: ['create', 'update', 'delete'], invitation: ['create', 'cancel'] },
    managers,
  ],
  ['empty the trash, export the archive', { archive: ['purge-trash', 'export'] }, managers],
  ['delete the family', { organization: ['delete'] }, ownerOnly],
];

const cases = matrix.flatMap(([row, request, allowed]) =>
  Object.entries(request).flatMap(([resource, actions]) =>
    actions.flatMap((action) =>
      FAMILY_ROLES.map((role) => ({ row, resource, action, role, expected: allowed[role] })),
    ),
  ),
);

describe('role matrix', () => {
  it.each(cases)(
    '$row: $role → $resource:$action = $expected',
    ({ resource, action, role, expected }) => {
      const authorize = roles[role].authorize as (request: Record<string, string[]>) => {
        success: boolean;
      };
      expect(authorize({ [resource]: [action] }).success).toBe(expected);
    },
  );

  it('rejects unknown actions at compile time', () => {
    // @ts-expect-error unknown action
    expect(roles.member.authorize({ asset: ['fly'] }).success).toBe(false);
  });
});

describe('family roles', () => {
  it('lists exactly the four roles', () => {
    expect(FAMILY_ROLES).toEqual(['owner', 'admin', 'member', 'viewer']);
    expect(Object.keys(roles).sort()).toEqual([...FAMILY_ROLES].sort());
  });

  it.each(['owner', 'admin', 'member', 'viewer'])('recognizes %s', (value) => {
    expect(isFamilyRole(value)).toBe(true);
  });

  it.each(['guest', '', 'Owner', undefined, 42, 'toString'])('rejects %s', (value) => {
    expect(isFamilyRole(value)).toBe(false);
  });
});
