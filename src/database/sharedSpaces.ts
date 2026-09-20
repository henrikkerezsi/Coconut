import type { SQLiteDatabase } from 'expo-sqlite';
import type { SharedMemberRole, SharedMemberStatus, SharedSpace, SharedSpaceMember } from '../models';
import { getDatabase } from './database';
import { decoupleSharedTransactions } from './sharedLinking';

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

export async function setMemberDisplayNameForUser(
  userId: string,
  displayName: string | null,
  db?: SQLiteDatabase
): Promise<void> {
  const database = db ?? (await getDatabase());
  await database.runAsync('UPDATE shared_space_members SET display_name = ? WHERE user_id = ?', [
    displayName,
    userId,
  ]);
}

export async function createSharedSpace(
  input: { name: string; ownerUserId: string | null; ownerEmail: string | null; ownerDisplayName: string | null },
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
      `INSERT INTO shared_space_members (space_id, user_id, email, display_name, role, status, joined_at)
       VALUES (?, ?, ?, ?, 'owner', 'active', strftime('%Y-%m-%dT%H:%M:%fZ','now'))`,
      [spaceId, input.ownerUserId, input.ownerEmail, input.ownerDisplayName]
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

export async function removeSpaceMember(
  memberId: number,
  db?: SQLiteDatabase
): Promise<void> {
  const database = db ?? (await getDatabase());
  const member = await database.getFirstAsync<SharedMemberRow>(
    'SELECT * FROM shared_space_members WHERE id = ?',
    [memberId]
  );
  if (!member || member.role === 'owner') {
    return;
  }
  await database.runAsync("UPDATE shared_space_members SET status = 'left' WHERE id = ?", [
    memberId,
  ]);
}

export async function deleteSharedSpace(id: number, db?: SQLiteDatabase): Promise<void> {
  const database = db ?? (await getDatabase());
  await database.withTransactionAsync(async () => {
    const space = await database.getFirstAsync<SharedSpaceRow>(
      'SELECT * FROM shared_spaces WHERE id = ?',
      [id]
    );
    if (!space) {
      return;
    }
    const expenseUuids = await database.getAllAsync<{ uuid: string | null }>(
      'SELECT uuid FROM shared_expenses WHERE space_id = ? AND uuid IS NOT NULL',
      [id]
    );
    await decoupleSharedTransactions(
      expenseUuids.map((row) => row.uuid as string),
      database
    );
    // Delete children before the space so the DELETE triggers can resolve each
    // tombstone's space_uuid from the still-present shared_spaces row.
    await database.runAsync(
      `DELETE FROM shared_expense_splits
        WHERE expense_id IN (SELECT id FROM shared_expenses WHERE space_id = ?)`,
      [id]
    );
    await database.runAsync('DELETE FROM shared_expenses WHERE space_id = ?', [id]);
    await database.runAsync('DELETE FROM shared_period_reports WHERE space_id = ?', [id]);
    await database.runAsync('DELETE FROM shared_periods WHERE space_id = ?', [id]);
    await database.runAsync('DELETE FROM shared_space_members WHERE space_id = ?', [id]);
    await database.runAsync('DELETE FROM shared_spaces WHERE id = ?', [id]);
    // Child tombstones are dropped: on the remote side the space row's cascade
    // wipes them anyway. The space's own tombstone survives to drive the remote
    // DELETE (which is what triggers that cascade for other members).
    await database.runAsync(
      `DELETE FROM shared_sync_tombstones
        WHERE table_name != 'shared_spaces'
          AND NOT EXISTS (SELECT 1 FROM shared_spaces s WHERE s.uuid = shared_sync_tombstones.space_uuid)`,
      []
    );
    if (space.uuid) {
      await database.runAsync(
        `INSERT INTO shared_sync_tombstones (table_name, row_key, space_uuid, deleted_at)
         VALUES ('shared_spaces', ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ','now'))
         ON CONFLICT (table_name, row_key) DO UPDATE SET deleted_at = excluded.deleted_at`,
        [space.uuid, space.uuid]
      );
    } else {
      await database.runAsync(
        "DELETE FROM shared_sync_tombstones WHERE table_name = 'shared_spaces' AND row_key IS NULL",
        []
      );
    }
  });
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
