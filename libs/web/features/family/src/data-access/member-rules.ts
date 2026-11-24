import type { FamilyRole } from '@swarm-keeper/permissions';

const ROLES: readonly FamilyRole[] = ['owner', 'admin', 'member', 'viewer'];

/** Roles the actor may give in an invitation: only an owner grants the owner role. */
export function inviteRoles(actor: string | null): FamilyRole[] {
  if (actor === 'owner') return [...ROLES];
  if (actor === 'admin') return ROLES.filter((role) => role !== 'owner');
  return [];
}

/**
 * Whether the actor will be able to change this member's role or remove them: never
 * themselves; an owner anyone else; an admin anyone who is not an owner.
 */
export function canManage(
  actor: { userId: string; role: string | null },
  member: { userId: string; role: string },
): boolean {
  if (actor.userId === member.userId) return false;
  if (actor.role === 'owner') return true;
  if (actor.role === 'admin') return member.role !== 'owner';
  return false;
}

/** An invitation whose expiry has passed (Better Auth no longer treats it as pending). */
export function isExpired(row: { expiresAt: string }, now = new Date()): boolean {
  return new Date(row.expiresAt).getTime() <= now.getTime();
}
