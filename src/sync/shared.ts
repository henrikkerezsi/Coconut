import type { SupabaseClient } from '@supabase/supabase-js';
import type { SQLiteDatabase, SQLiteBindValue } from 'expo-sqlite';

import { withPullGuard } from '../database/syncMeta';
import { decoupleSharedTransactions } from '../database/sharedLinking';
import { SHARED_ADAPTERS } from './shared-serialize';
import { isRemoteNewer, nowIso } from './time';
import type { SyncTableAdapter } from './serialize';

const SHARED_EPOCH = '1970-01-01T00:00:00.000Z';

const SHARED_TABLE_SET = new Set(SHARED_ADAPTERS.map((adapter) => adapter.localTable));

interface OutboxEntry {
  table_name: string;
  row_key: string;
}

interface SharedTombstoneEntry {
  table_name: string;
  row_key: string;
  space_uuid: string | null;
  deleted_at: string;
}

interface PushFkMaps {
  spaceUuidById: Map<string, string>;
  memberUuidById: Map<string, string>;
  periodUuidById: Map<string, string>;
  expenseUuidById: Map<string, string>;
}

interface PullFkMaps {
  spaceIdByUuid: Map<string, number>;
  memberIdByUuid: Map<string, number>;
  periodIdByUuid: Map<string, number>;
  expenseIdByUuid: Map<string, number>;
}

function toBindValue(value: unknown): SQLiteBindValue {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === 'string' || typeof value === 'number') {
    return value;
  }
  return String(value);
}

function readLocalRow(
  db: SQLiteDatabase,
  adapter: SyncTableAdapter,
  rowKey: string
): Promise<{ [key: string]: unknown } | null> {
  return db.getFirstAsync<{ [key: string]: unknown }>(
    `SELECT * FROM ${adapter.localTable} WHERE uuid = ?`,
    [rowKey]
  );
}

async function loadPushFkMaps(db: SQLiteDatabase): Promise<PushFkMaps> {
  const [spaces, members, periods, expenses] = await Promise.all([
    db.getAllAsync<{ id: number; uuid: string }>(
      'SELECT id, uuid FROM shared_spaces WHERE uuid IS NOT NULL'
    ),
    db.getAllAsync<{ id: number; uuid: string }>(
      'SELECT id, uuid FROM shared_space_members WHERE uuid IS NOT NULL'
    ),
    db.getAllAsync<{ id: number; uuid: string }>(
      'SELECT id, uuid FROM shared_periods WHERE uuid IS NOT NULL'
    ),
    db.getAllAsync<{ id: number; uuid: string }>(
      'SELECT id, uuid FROM shared_expenses WHERE uuid IS NOT NULL'
    ),
  ]);
  return {
    spaceUuidById: new Map(spaces.map((row) => [String(row.id), row.uuid])),
    memberUuidById: new Map(members.map((row) => [String(row.id), row.uuid])),
    periodUuidById: new Map(periods.map((row) => [String(row.id), row.uuid])),
    expenseUuidById: new Map(expenses.map((row) => [String(row.id), row.uuid])),
  };
}

async function loadPullFkMaps(db: SQLiteDatabase): Promise<PullFkMaps> {
  const [spaces, members, periods, expenses] = await Promise.all([
    db.getAllAsync<{ uuid: string; id: number }>(
      'SELECT uuid, id FROM shared_spaces WHERE uuid IS NOT NULL'
    ),
    db.getAllAsync<{ uuid: string; id: number }>(
      'SELECT uuid, id FROM shared_space_members WHERE uuid IS NOT NULL'
    ),
    db.getAllAsync<{ uuid: string; id: number }>(
      'SELECT uuid, id FROM shared_periods WHERE uuid IS NOT NULL'
    ),
    db.getAllAsync<{ uuid: string; id: number }>(
      'SELECT uuid, id FROM shared_expenses WHERE uuid IS NOT NULL'
    ),
  ]);
  return {
    spaceIdByUuid: new Map(spaces.map((row) => [row.uuid, row.id])),
    memberIdByUuid: new Map(members.map((row) => [row.uuid, row.id])),
    periodIdByUuid: new Map(periods.map((row) => [row.uuid, row.id])),
    expenseIdByUuid: new Map(expenses.map((row) => [row.uuid, row.id])),
  };
}

function pushFkResolver(maps: PushFkMaps) {
  return (localField: string, localValue: string | number | null): string | null => {
    if (localValue === null || localValue === undefined) {
      return null;
    }
    switch (localField) {
      case 'space_id':
        return maps.spaceUuidById.get(String(localValue)) ?? null;
      case 'member_id':
      case 'paid_by_member_id':
      case 'closed_by_member_id':
        return maps.memberUuidById.get(String(localValue)) ?? null;
      case 'period_id':
        return maps.periodUuidById.get(String(localValue)) ?? null;
      case 'expense_id':
        return maps.expenseUuidById.get(String(localValue)) ?? null;
      default:
        return null;
    }
  };
}

function pullFkResolver(maps: PullFkMaps) {
  return (remoteField: string, parentUuid: string | null): string | number | null => {
    if (parentUuid === null || parentUuid === undefined) {
      return null;
    }
    switch (remoteField) {
      case 'space_uuid':
        return maps.spaceIdByUuid.get(parentUuid) ?? null;
      case 'member_uuid':
      case 'paid_by_member_uuid':
      case 'closed_by_member_uuid':
        return maps.memberIdByUuid.get(parentUuid) ?? null;
      case 'period_uuid':
        return maps.periodIdByUuid.get(parentUuid) ?? null;
      case 'expense_uuid':
        return maps.expenseIdByUuid.get(parentUuid) ?? null;
      default:
        return null;
    }
  };
}

function hasUnresolvedFk(
  adapter: SyncTableAdapter,
  remote: Record<string, unknown>,
  values: Record<string, unknown>
): boolean {
  for (const field of adapter.fields) {
    if (!field.fk) {
      continue;
    }
    const remoteValue = remote[field.remote] as string | null;
    if (remoteValue != null && values[field.local] == null) {
      return true;
    }
  }
  return false;
}

function captureInsertedParent(
  maps: PullFkMaps,
  adapter: SyncTableAdapter,
  values: Record<string, unknown>,
  id: number
): void {
  const uuid = values.uuid as string | null;
  if (!uuid) {
    return;
  }
  if (adapter.localTable === 'shared_spaces') {
    maps.spaceIdByUuid.set(uuid, id);
  } else if (adapter.localTable === 'shared_space_members') {
    maps.memberIdByUuid.set(uuid, id);
  } else if (adapter.localTable === 'shared_periods') {
    maps.periodIdByUuid.set(uuid, id);
  } else if (adapter.localTable === 'shared_expenses') {
    maps.expenseIdByUuid.set(uuid, id);
  }
}

async function backfillSharedRows(db: SQLiteDatabase): Promise<void> {
  const timestamp = nowIso();
  for (const table of SHARED_TABLE_SET) {
    await db.runAsync(
      `UPDATE ${table}
          SET uuid = COALESCE(uuid, lower(hex(randomblob(16)))),
              updated_at = COALESCE(updated_at, ?)
        WHERE uuid IS NULL OR updated_at IS NULL`,
      [timestamp]
    );
  }
}

async function listPushEntries(db: SQLiteDatabase): Promise<Map<string, OutboxEntry[]>> {
  const outbox = await db.getAllAsync<OutboxEntry>(
    'SELECT table_name, row_key FROM sync_outbox ORDER BY id ASC'
  );
  const seeded = new Map<string, OutboxEntry[]>();
  for (const adapter of SHARED_ADAPTERS) {
    const rows = await db.getAllAsync<{ key: string }>(
      `SELECT uuid AS key FROM ${adapter.localTable} WHERE uuid IS NOT NULL`
    );
    seeded.set(
      adapter.localTable,
      rows.map((row) => ({ table_name: adapter.localTable, row_key: row.key }))
    );
  }
  for (const entry of outbox) {
    if (!SHARED_TABLE_SET.has(entry.table_name)) {
      continue;
    }
    const list = seeded.get(entry.table_name) ?? [];
    if (list.some((e) => e.row_key === entry.row_key)) {
      continue;
    }
    list.push(entry);
    seeded.set(entry.table_name, list);
  }
  return seeded;
}

async function pushSharedRow(
  client: SupabaseClient,
  db: SQLiteDatabase,
  adapter: SyncTableAdapter,
  entry: OutboxEntry,
  maps: PushFkMaps,
  userId: string
): Promise<void> {
  const localRow = await readLocalRow(db, adapter, entry.row_key);
  if (!localRow) {
    await db.runAsync('DELETE FROM sync_outbox WHERE table_name = ? AND row_key = ?', [
      entry.table_name,
      entry.row_key,
    ]);
    return;
  }
  const localUpdatedAt = (localRow.updated_at as string | null) ?? null;
  const { data, error } = await client
    .from(adapter.remoteTable)
    .select('uuid, updated_at')
    .eq('uuid', entry.row_key)
    .maybeSingle();
  if (error) {
    throw new Error(`Shared push lookup failed for ${adapter.remoteTable}: ${error.message}`);
  }
  if (data && isRemoteNewer(localUpdatedAt, data.updated_at as string | null)) {
    await db.runAsync('DELETE FROM sync_outbox WHERE table_name = ? AND row_key = ?', [
      entry.table_name,
      entry.row_key,
    ]);
    return;
  }
  const payload: Record<string, unknown> = {
    uuid: localRow.uuid ?? null,
    updated_at: localUpdatedAt ?? new Date().toISOString(),
    ...adapter.toRemote(localRow, pushFkResolver(maps)),
  };
  // Ownership is assigned from auth.uid() on insert: the client always claims a
  // brand-new space with the signed-in user's id so the insert passes RLS even
  // on projects whose column lacks the default, while existing rows are never
  // touched so members cannot re-own a space.
  if (adapter.localTable === 'shared_spaces') {
    if (data) {
      delete payload.owner_user_id;
    } else {
      payload.owner_user_id = userId;
    }
  }
  // Brand-new rows use a plain insert: an upsert with an ON CONFLICT arbiter
  // requires the proposed row to also satisfy the shared table's SELECT policy,
  // which is membership/ownership-based and can never match a row that does not
  // exist yet (the first push of a new space always failed RLS). Existing rows
  // keep the upsert so last-write-wins still merges diverged copies.
  const table = client.from(adapter.remoteTable);
  const { error: writeError } = data
    ? await table.upsert(payload, { onConflict: 'uuid' })
    : await table.insert(payload);
  if (writeError) {
    throw new Error(`Shared push failed for ${adapter.remoteTable}: ${writeError.message}`);
  }
  await db.runAsync('DELETE FROM sync_outbox WHERE table_name = ? AND row_key = ?', [
    entry.table_name,
    entry.row_key,
  ]);
}

async function pushSharedTombstones(
  client: SupabaseClient,
  db: SQLiteDatabase
): Promise<number> {
  const tombstones = await db.getAllAsync<SharedTombstoneEntry>(
    'SELECT table_name, row_key, space_uuid, deleted_at FROM shared_sync_tombstones ORDER BY id ASC'
  );
  if (tombstones.length === 0) {
    return 0;
  }
  const adapterByTable = new Map(SHARED_ADAPTERS.map((adapter) => [adapter.localTable, adapter]));
  const ordered = [...tombstones].sort((a, b) => {
    const pa = adapterByTable.get(a.table_name)?.pullOrder ?? 0;
    const pb = adapterByTable.get(b.table_name)?.pullOrder ?? 0;
    return pb - pa;
  });
  for (const tombstone of ordered) {
    const adapter = adapterByTable.get(tombstone.table_name);
    if (!adapter) {
      await db.runAsync(
        'DELETE FROM shared_sync_tombstones WHERE table_name = ? AND row_key = ?',
        [tombstone.table_name, tombstone.row_key]
      );
      continue;
    }
    const { error: deleteError } = await client
      .from(adapter.remoteTable)
      .delete()
      .eq('uuid', tombstone.row_key);
    if (deleteError) {
      throw new Error(`Shared delete failed for ${adapter.remoteTable}: ${deleteError.message}`);
    }
    // A space deletion needs no remote tombstone: deleting the shared_spaces row
    // cascades every child row off the remote anyway, and a tombstone row
    // referencing the deleted space would be cascade-deleted (or FK-rejected) on
    // insert. Other devices detect the removal on pull by the space row being
    // gone. All other shared tables re-write the tombstone first so contact
    // that leaves other members offline can still catch up later.
    if (adapter.localTable !== 'shared_spaces') {
      const { error: tombstoneError } = await client.from('shared_sync_tombstones').upsert(
        {
          space_uuid: tombstone.space_uuid,
          table_name: tombstone.table_name,
          row_key: tombstone.row_key,
          deleted_at: tombstone.deleted_at,
        },
        { onConflict: 'space_uuid,table_name,row_key' }
      );
      if (tombstoneError) {
        throw new Error(`Shared tombstone failed: ${tombstoneError.message}`);
      }
    }
    await db.runAsync(
      'DELETE FROM shared_sync_tombstones WHERE table_name = ? AND row_key = ?',
      [tombstone.table_name, tombstone.row_key]
    );
  }
  return ordered.length;
}

export interface SharedPushResult {
  pushed: number;
  tombstones: number;
}

export async function pushSharedChanges(
  client: SupabaseClient,
  db: SQLiteDatabase,
  userId: string
): Promise<SharedPushResult> {
  await backfillSharedRows(db);
  const maps = await loadPushFkMaps(db);
  const entriesByTable = await listPushEntries(db);
  let pushed = 0;
  for (const adapter of SHARED_ADAPTERS) {
    for (const entry of entriesByTable.get(adapter.localTable) ?? []) {
      await pushSharedRow(client, db, adapter, entry, maps, userId);
      pushed += 1;
    }
  }
  const tombstones = await pushSharedTombstones(client, db);
  return { pushed, tombstones };
}

async function applySharedRemoteRow(
  db: SQLiteDatabase,
  adapter: SyncTableAdapter,
  remote: Record<string, unknown>,
  maps: PullFkMaps
): Promise<void> {
  const uuid = (remote.uuid as string) ?? '';
  if (!uuid) {
    return;
  }
  const remoteUpdatedAt = (remote.updated_at as string | null) ?? null;
  const values: Record<string, unknown> = adapter.fromRemote(remote, pullFkResolver(maps));
  values.uuid = uuid;
  values.updated_at = remoteUpdatedAt;
  if (hasUnresolvedFk(adapter, remote, values)) {
    return;
  }
  const existing = await db.getFirstAsync<{ id: number; updated_at: string | null }>(
    `SELECT id, updated_at FROM ${adapter.localTable} WHERE uuid = ?`,
    [uuid]
  );
  if (existing) {
    if (!isRemoteNewer(existing.updated_at, remoteUpdatedAt)) {
      return;
    }
    const columns = Object.keys(values);
    const sql = columns.map((col) => `${col} = ?`).join(', ');
    await db.runAsync(`UPDATE ${adapter.localTable} SET ${sql} WHERE uuid = ?`, [
      ...columns.map((col) => toBindValue(values[col])),
      uuid,
    ]);
    return;
  }
  const columns = Object.keys(values);
  const result = await db.runAsync(
    `INSERT INTO ${adapter.localTable} (${columns.join(', ')}) VALUES (${columns
      .map(() => '?')
      .join(', ')})`,
    columns.map((col) => toBindValue(values[col]))
  );
  captureInsertedParent(maps, adapter, values, result.lastInsertRowId);
}

async function applySharedRemoteTombstones(
  db: SQLiteDatabase,
  client: SupabaseClient
): Promise<number> {
  const { data, error } = await client
    .from('shared_sync_tombstones')
    .select('table_name, row_key')
    .gt('deleted_at', SHARED_EPOCH);
  if (error) {
    throw new Error(`Shared tombstone pull failed: ${error.message}`);
  }
  const adapterByTable = new Map(SHARED_ADAPTERS.map((adapter) => [adapter.localTable, adapter]));
  let applied = 0;
  for (const tomb of data ?? []) {
    const adapter = adapterByTable.get(tomb.table_name as string);
    if (!adapter) {
      continue;
    }
    await db.runAsync(`DELETE FROM ${adapter.localTable} WHERE uuid = ?`, [tomb.row_key]);
    await db.runAsync('DELETE FROM sync_outbox WHERE table_name = ? AND row_key = ?', [
      tomb.table_name,
      tomb.row_key,
    ]);
    applied += 1;
  }
  return applied;
}

async function expireRemovedSpaces(
  db: SQLiteDatabase,
  remoteSpaceUuids: Set<string>
): Promise<number> {
  const locals = await db.getAllAsync<{ id: number; uuid: string }>(
    'SELECT id, uuid FROM shared_spaces WHERE uuid IS NOT NULL'
  );
  let removed = 0;
  for (const space of locals) {
    if (remoteSpaceUuids.has(space.uuid)) {
      continue;
    }
    const expenseUuids = (
      await db.getAllAsync<{ uuid: string | null }>(
        'SELECT uuid FROM shared_expenses WHERE space_id = ? AND uuid IS NOT NULL',
        [space.id]
      )
    ).map((row) => row.uuid as string);
    await decoupleSharedTransactions(expenseUuids, db);
    await db.runAsync(
      `DELETE FROM shared_expense_splits
        WHERE expense_id IN (SELECT id FROM shared_expenses WHERE space_id = ?)`,
      [space.id]
    );
    await db.runAsync('DELETE FROM shared_expenses WHERE space_id = ?', [space.id]);
    await db.runAsync('DELETE FROM shared_period_reports WHERE space_id = ?', [space.id]);
    await db.runAsync('DELETE FROM shared_periods WHERE space_id = ?', [space.id]);
    await db.runAsync('DELETE FROM shared_space_members WHERE space_id = ?', [space.id]);
    await db.runAsync('DELETE FROM shared_spaces WHERE id = ?', [space.id]);
    removed += 1;
  }
  // Drop 'left' membership rows left behind after their space stopped being
  // visible (e.g. the removed user pulled their own row, then the space).
  await db.runAsync(
    `DELETE FROM shared_space_members
      WHERE status = 'left'
        AND NOT EXISTS (SELECT 1 FROM shared_spaces s WHERE s.id = shared_space_members.space_id)`
  );
  return removed;
}

export interface SharedPullResult {
  pulled: number;
  tombstones: number;
  expiredSpaces: number;
}

export async function pullSharedChanges(
  client: SupabaseClient,
  db: SQLiteDatabase
): Promise<SharedPullResult> {
  const maps = await loadPullFkMaps(db);
  let pulled = 0;
  let tombstones = 0;
  let expired = 0;
  await withPullGuard(db, async () => {
    tombstones = await applySharedRemoteTombstones(db, client);
    const remoteSpaceUuids = new Set<string>();
    for (const adapter of SHARED_ADAPTERS) {
      const { data, error } = await client
        .from(adapter.remoteTable)
        .select('*')
        .order('updated_at', { ascending: true });
      if (error) {
        throw new Error(`Shared pull failed for ${adapter.remoteTable}: ${error.message}`);
      }
      for (const remoteRow of (data ?? []) as Record<string, unknown>[]) {
        await applySharedRemoteRow(db, adapter, remoteRow, maps);
        pulled += 1;
        if (adapter.localTable === 'shared_spaces' && typeof remoteRow.uuid === 'string') {
          remoteSpaceUuids.add(remoteRow.uuid);
        }
      }
    }
    // A space vanishes from a member's pull when it is deleted by the owner or
    // when that member's own access is revoked: drop the local copy (and its
    // children) and decouple, never delete, the linked personal transactions.
    expired = await expireRemovedSpaces(db, remoteSpaceUuids);
  });
  return { pulled, tombstones, expiredSpaces: expired };
}
