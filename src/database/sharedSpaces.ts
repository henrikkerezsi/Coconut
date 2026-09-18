import type { SQLiteDatabase } from 'expo-sqlite';
import type { SharedMemberRole, SharedMemberStatus, SharedSpace, SharedSpaceMember } from '../models';
import { getDatabase } from './database';

interface SharedSpaceRow {
  id: number;
  uuid: string | null;
  name: string;
  owner_user_id: string | null;
  created_at: string;
  updated_at: string | null;
  deleted: number;
}

interface SharedMemberRow {
  id: number;
  uuid: string | null;
  space_id: number;
  user_id: string | null;
  email: string | null;
  display_name: string | null;
  role: SharedMemberRole;
  status: SharedMemberStatus;
  joined_at: string | null;
  updated_at: string | null;
}

function rowToSpace(row: SharedSpaceRow): SharedSpace {
  return {
    id: row.id,
    uuid: row.uuid,
    name: row.name,
    ownerUserId: row.owner_user_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deleted: row.deleted === 1,
  };
}

function rowToMember(row: SharedMemberRow): SharedSpaceMember {
  return {
    id: row.id,
    uuid: row.uuid,
    spaceId: row.space_id,
    userId: row.user_id,
    email: row.email,
    displayName: row.display_name,
    role: row.role,
    status: row.status,
    joinedAt: row.joined_at,
    updatedAt: row.updated_at,
  };
}

export async function getAllSharedSpaces(db?: SQLiteDatabase): Promise<SharedSpace[]> {
  const database = db ?? (await getDatabase());
  const rows = await database.getAllAsync<SharedSpaceRow>(
    'SELECT * FROM shared_spaces WHERE deleted = 0 ORDER BY created_at ASC, id ASC'
  );
  return rows.map(rowToSpace);
}

export async function getSharedSpace(
  id: number,
  db?: SQLiteDatabase
): Promise<SharedSpace | null> {
  const database = db ?? (await getDatabase());
  const row = await database.getFirstAsync<SharedSpaceRow>(
    'SELECT * FROM shared_spaces WHERE id = ?',
    [id]
  );
  return row ? rowToSpace(row) : null;
}

export async function createSharedSpace(
  input: { name: string; ownerUserId: string | null; ownerEmail: string | null },
  db?: SQLiteDatabase
): Promise<number> {
  const database = db ?? (await getDatabase());
  let spaceId = 0;
  await database.withTransactionAsync(async () => {
    const result = await database.runAsync(
      'INSERT INTO shared_spaces (name, owner_user_id) VALUES (?, ?)',
      [input.name.trim(), input.ownerUserId]
    );
    spaceId = result.lastInsertRowId;
    await database.runAsync(
      `INSERT INTO shared_space_members (space_id, user_id, email, role, status, joined_at)
       VALUES (?, ?, ?, 'owner', 'active', strftime('%Y-%m-%dT%H:%M:%fZ','now'))`,
      [spaceId, input.ownerUserId, input.ownerEmail]
    );
  });
  return spaceId;
}

export async function renameSharedSpace(
  id: number,
  name: string,
  db?: SQLiteDatabase
): Promise<void> {
  const database = db ?? (await getDatabase());
  await database.runAsync('UPDATE shared_spaces SET name = ? WHERE id = ?', [name.trim(), id]);
}

export async function getSpaceMembers(
  spaceId: number,
  db?: SQLiteDatabase
): Promise<SharedSpaceMember[]> {
  const database = db ?? (await getDatabase());
  const rows = await database.getAllAsync<SharedMemberRow>(
    `SELECT * FROM shared_space_members
      WHERE space_id = ? AND status != 'left'
      ORDER BY CASE role WHEN 'owner' THEN 0 ELSE 1 END, joined_at ASC, id ASC`,
    [spaceId]
  );
  return rows.map(rowToMember);
}

export async function getActiveMembers(
  spaceId: number,
  db?: SQLiteDatabase
): Promise<SharedSpaceMember[]> {
  const database = db ?? (await getDatabase());
  const rows = await database.getAllAsync<SharedMemberRow>(
    `SELECT * FROM shared_space_members
      WHERE space_id = ? AND status = 'active'
      ORDER BY CASE role WHEN 'owner' THEN 0 ELSE 1 END, joined_at ASC, id ASC`,
    [spaceId]
  );
  return rows.map(rowToMember);
}

export async function getMember(
  id: number,
  db?: SQLiteDatabase
): Promise<SharedSpaceMember | null> {
  const database = db ?? (await getDatabase());
  const row = await database.getFirstAsync<SharedMemberRow>(
    'SELECT * FROM shared_space_members WHERE id = ?',
    [id]
  );
  return row ? rowToMember(row) : null;
}

export async function getMemberForUser(
  spaceId: number,
  userId: string,
  db?: SQLiteDatabase
): Promise<SharedSpaceMember | null> {
  const database = db ?? (await getDatabase());
  const row = await database.getFirstAsync<SharedMemberRow>(
    'SELECT * FROM shared_space_members WHERE space_id = ? AND user_id = ? LIMIT 1',
    [spaceId, userId]
  );
  return row ? rowToMember(row) : null;
}

export async function addPendingMember(
  spaceId: number,
  email: string,
  db?: SQLiteDatabase
): Promise<number> {
  const database = db ?? (await getDatabase());
  const normalized = email.trim().toLowerCase();
  const existing = await database.getFirstAsync<SharedMemberRow>(
    'SELECT * FROM shared_space_members WHERE space_id = ? AND email = ? LIMIT 1',
    [spaceId, normalized]
  );
  if (existing) {
    if (existing.status === 'left') {
      await database.runAsync(
        `UPDATE shared_space_members SET status = 'pending', role = 'member' WHERE id = ?`,
        [existing.id]
      );
    }
    return existing.id;
  }
  const result = await database.runAsync(
    `INSERT INTO shared_space_members (space_id, email, role, status)
     VALUES (?, ?, 'member', 'pending')`,
    [spaceId, normalized]
  );
  return result.lastInsertRowId;
}

export async function acceptInvite(
  memberId: number,
  userId: string,
  displayName: string | null,
  db?: SQLiteDatabase
): Promise<void> {
  const database = db ?? (await getDatabase());
  await database.runAsync(
    `UPDATE shared_space_members
        SET user_id = ?, display_name = ?, status = 'active',
            joined_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
      WHERE id = ?`,
    [userId, displayName, memberId]
  );
}

export async function setMemberStatus(
  memberId: number,
  status: SharedMemberStatus,
  db?: SQLiteDatabase
): Promise<void> {
  const database = db ?? (await getDatabase());
  await database.runAsync('UPDATE shared_space_members SET status = ? WHERE id = ?', [
    status,
    memberId,
  ]);
}

export async function getPendingInvitesForEmail(
  email: string,
  db?: SQLiteDatabase
): Promise<SharedSpaceMember[]> {
  const database = db ?? (await getDatabase());
  const rows = await database.getAllAsync<SharedMemberRow>(
    `SELECT * FROM shared_space_members
      WHERE status = 'pending' AND email = ?
      ORDER BY id ASC`,
    [email.trim().toLowerCase()]
  );
  return rows.map(rowToMember);
}
