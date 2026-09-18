import type { SharedSpaceMember } from '../models';

export function sharedMemberName(member: SharedSpaceMember): string {
  return member.displayName ?? member.email ?? `Member #${member.id}`;
}

export function sharedMemberRoleLabel(member: SharedSpaceMember): string {
  if (member.role === 'owner') {
    return 'Owner';
  }
  return member.status === 'pending' ? 'Invite pending' : 'Member';
}
