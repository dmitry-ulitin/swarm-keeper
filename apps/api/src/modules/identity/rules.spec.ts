import { describe, expect, it } from 'vitest';
import { isAdminAction, permissionsOf, twoFactorRequired } from './rules.js';

describe('isAdminAction', () => {
  it.each([
    ['asset', 'manage', true],
    ['album', 'manage', true],
    ['archive', 'export', true],
    ['archive', 'purge-trash', true],
    ['member', 'create', true],
    ['invitation', 'create', true],
    ['organization', 'delete', true],
    ['asset', 'create', false],
    ['asset', 'read', false],
    ['album', 'delete', false],
  ] as const)('%s:%s → %s', (resource, action, expected) => {
    expect(isAdminAction(resource, action)).toBe(expected);
  });
});

describe('permissionsOf', () => {
  it('gives a viewer read access only', () => {
    expect(permissionsOf('viewer')).toEqual(['album:read', 'asset:read']);
  });

  it('lets a member add and edit, but not manage others or export', () => {
    const member = permissionsOf('member');
    expect(member).toEqual(
      expect.arrayContaining(['asset:create', 'asset:delete', 'album:update']),
    );
    expect(member).not.toContain('asset:manage');
    expect(member).not.toContain('archive:export');
  });

  it('gives the owner everything the admin has, plus deleting the family', () => {
    const owner = permissionsOf('owner');
    expect(owner).toEqual(expect.arrayContaining(permissionsOf('admin')));
    expect(owner).toContain('organization:delete');
    expect(permissionsOf('admin')).not.toContain('organization:delete');
  });
});

describe('twoFactorRequired', () => {
  it.each([
    [{ twoFactorEnabled: false }, true, true],
    [{ twoFactorEnabled: null }, true, true],
    [{ twoFactorEnabled: true }, true, false],
    [{ twoFactorEnabled: false }, false, false],
  ])('%o with password=%s → %s', (user, hasPassword, expected) => {
    expect(twoFactorRequired(user, hasPassword)).toBe(expected);
  });
});
