import { describe, expect, it } from 'vitest';
import { canManage, inviteRoles, isExpired } from './member-rules';

describe('inviteRoles', () => {
  it('lets only an owner invite an owner', () => {
    expect(inviteRoles('owner')).toEqual(['owner', 'admin', 'member', 'viewer']);
    expect(inviteRoles('admin')).toEqual(['admin', 'member', 'viewer']);
    expect(inviteRoles('admin')).not.toContain('owner');
  });

  it('gives nothing to people who cannot invite', () => {
    expect(inviteRoles('member')).toEqual([]);
    expect(inviteRoles('viewer')).toEqual([]);
  });
});

describe('canManage', () => {
  const owner = { userId: 'o', role: 'owner' };
  const admin = { userId: 'a', role: 'admin' };
  const member = { userId: 'm', role: 'member' };
  const viewer = { userId: 'v', role: 'viewer' };

  it.each([
    ['nobody manages themselves', owner, owner, false],
    ['an owner manages an admin', owner, admin, true],
    ['an owner manages another owner', owner, { userId: 'o2', role: 'owner' }, true],
    ['an admin does not manage an owner', admin, owner, false],
    ['an admin manages a member', admin, member, true],
    ['a member manages nobody', member, viewer, false],
  ])('%s', (_label, actor, target, expected) => {
    expect(canManage(actor, target)).toBe(expected);
  });
});

describe('isExpired', () => {
  const now = new Date('2026-11-24T12:00:00.000Z');
  it('is expired at and after the expiry time', () => {
    expect(isExpired({ expiresAt: '2026-11-24T12:00:00.000Z' }, now)).toBe(true);
    expect(isExpired({ expiresAt: '2026-11-24T11:59:59.000Z' }, now)).toBe(true);
    expect(isExpired({ expiresAt: '2026-11-24T12:00:01.000Z' }, now)).toBe(false);
  });
});
