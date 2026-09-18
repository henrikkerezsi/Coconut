import type { SupabaseClient } from '@supabase/supabase-js';
import type { SQLiteDatabase } from 'expo-sqlite';

import { COMPLETE_ADAPTERS, SYNC_SETTINGS_KEYS, type SyncTableAdapter } from './serialize';
import { isRemoteNewer } from './time';
import { getSupabaseUserId, SyncAuthError } from './supabase';

interface OutboxEntry {
  table_name: string;
  row_key: string;
}

interface TombstoneEntry {
  table_name: string;
  row_key: string;
  deleted_at: string;
}

async function listOutbox(db: SQLiteDatabase): Promise<OutboxEntry[]> {
  return db.getAllAsync<OutboxEntry>(
    'SELECT table_name, row_key FROM sync_outbox ORDER BY id ASC'
  );
}

async function listAllRowKeys(
  db: SQLiteDatabase,
  adapter: SyncTableAdapter
): Promise<OutboxEntry[]> {
  const rows = await db.getAllAsync<{ key: string }>(
    `SELECT ${adapter.identityColumn} AS key FROM ${adapter.localTable}`
  );
  return rows.map((row) => ({ table_name: adapter.localTable, row_key: row.key }));
}

async function buildEntries(
  db: SQLiteDatabase,
  full: boolean
): Promise<Map<string, OutboxEntry[]>> {
  let entries = await listOutbox(db);
  if (full) {
    const seeded = new Map<string, OutboxEntry[]>();
    for (const adapter of COMPLETE_ADAPTERS) {
      for (const entry of await listAllRowKeys(db, adapter)) {
        const list = seeded.get(entry.table_name) ?? [];
        list.push(entry);
        seeded.set(entry.table_name, list);
      }
    }
    for (const entry of entries) {
      const list = seeded.get(entry.table_name) ?? [];
      list.push(entry);
      seeded.set(entry.table_name, list);
    }
    entries = [...seeded.values()].flat();
  }
  const entriesByTable = new Map<string, OutboxEntry[]>();
  for (const entry of entries) {
    const list = entriesByTable.get(entry.table_name) ?? [];
    list.push(entry);
    entriesByTable.set(entry.table_name, list);
  }
  return entriesByTable;
}

async function listTombstones(db: SQLiteDatabase): Promise<TombstoneEntry[]> {
  return db.getAllAsync<TombstoneEntry>(
    'SELECT table_name, row_key, deleted_at FROM sync_tombstones ORDER BY id ASC'
  );
}

async function pruneOutbox(db: SQLiteDatabase, table: string, rowKey: string): Promise<void> {
  await db.runAsync('DELETE FROM sync_outbox WHERE table_name = ? AND row_key = ?', [
    table,
    rowKey,
  ]);
}

async function readLocalRow(
  db: SQLiteDatabase,
  adapter: SyncTableAdapter,
  rowKey: string
): Promise<{ [key: string]: unknown } | null> {
  if (adapter.identityColumn === 'month_key') {
    return db.getFirstAsync<{ [key: string]: unknown }>(
      'SELECT * FROM months WHERE month_key = ?',
      [rowKey]
    );
  }
  return db.getFirstAsync<{ [key: string]: unknown }>(
    `SELECT * FROM ${adapter.localTable} WHERE uuid = ?`,
    [rowKey]
  );
}

async function loadUuidMap(
  db: SQLiteDatabase,
  localField: string,
  parentTable: string
): Promise<Map<string, string>> {
  const rows = await db.getAllAsync<{ id: number; uuid: string }>(
    `SELECT id, uuid FROM ${parentTable} WHERE uuid IS NOT NULL`
  );
  return new Map(rows.map((row) => [String(row.id), row.uuid]));
}

interface FkMaps {
  budgetUuidByBudgetId: Map<string, string>;
  fixedExpenseUuidByFixedExpenseId: Map<string, string>;
}

async function loadFkMaps(db: SQLiteDatabase): Promise<FkMaps> {
  const [budgetUuidByBudgetId, fixedExpenseUuidByFixedExpenseId] = await Promise.all([
    loadUuidMap(db, 'budget_id', 'budgets'),
    loadUuidMap(db, 'fixed_expense_id', 'fixed_expenses'),
  ]);
  return { budgetUuidByBudgetId, fixedExpenseUuidByFixedExpenseId };
}

function pushFkResolver(maps: FkMaps) {
  return (localField: string, localValue: string | number | null): string | null => {
    if (localValue === null || localValue === undefined) {
      return null;
    }
    if (localField === 'budget_id') {
      return maps.budgetUuidByBudgetId.get(String(localValue)) ?? null;
    }
    if (localField === 'fixed_expense_id') {
      return maps.fixedExpenseUuidByFixedExpenseId.get(String(localValue)) ?? null;
    }
    return null;
  };
}

async function remoteUpdatedAtOf(
  client: SupabaseClient,
  adapter: SyncTableAdapter,
  rowKey: string
): Promise<string | null> {
  if (adapter.identityColumn === 'month_key') {
    const { data } = await client
      .from(adapter.remoteTable)
      .select('month_key, updated_at')
      .eq('month_key', rowKey)
      .maybeSingle();
    return data ? (data.updated_at as string | null) : null;
  }
  const { data } = await client
    .from(adapter.remoteTable)
    .select('uuid, updated_at')
    .eq('uuid', rowKey)
    .maybeSingle();
  return data ? (data.updated_at as string | null) : null;
}

async function pushRow(
  client: SupabaseClient,
  db: SQLiteDatabase,
  adapter: SyncTableAdapter,
  entry: OutboxEntry,
  userId: string,
  maps: FkMaps
): Promise<void> {
  const localRow = await readLocalRow(db, adapter, entry.row_key);
  if (!localRow) {
    await pruneOutbox(db, entry.table_name, entry.row_key);
    return;
  }

  const remoteUpdatedAt = await remoteUpdatedAtOf(client, adapter, entry.row_key);
  const localUpdatedAt = (localRow.updated_at as string | null) ?? null;
  if (remoteUpdatedAt && !isRemoteNewer(localUpdatedAt, remoteUpdatedAt)) {
    await pruneOutbox(db, entry.table_name, entry.row_key);
    return;
  }

  const payload: Record<string, unknown> = {
    user_id: userId,
    uuid: localRow.uuid ?? null,
    month_key: localRow.month_key ?? null,
    updated_at: localUpdatedAt ?? new Date().toISOString(),
    ...adapter.toRemote(localRow, pushFkResolver(maps)),
  };

  const table = client.from(adapter.remoteTable);
  const onConflict =
    adapter.identityColumn === 'month_key' ? 'user_id,month_key' : 'uuid';
  await table.upsert(payload, { onConflict });
  await pruneOutbox(db, entry.table_name, entry.row_key);
}

async function deleteRemoteRow(
  client: SupabaseClient,
  adapter: SyncTableAdapter,
  rowKey: string
): Promise<void> {
  const query = client.from(adapter.remoteTable).delete();
  if (adapter.identityColumn === 'month_key') {
    await query.eq('month_key', rowKey);
  } else {
    await query.eq('uuid', rowKey);
  }
}

async function pushTombstones(
  client: SupabaseClient,
  db: SQLiteDatabase,
  userId: string
): Promise<number> {
  const tombstones = await listTombstones(db);
  if (tombstones.length === 0) {
    return 0;
  }
  const adapterByTable = new Map(COMPLETE_ADAPTERS.map((a) => [a.localTable, a]));
  const ordered = [...tombstones].sort((a, b) => {
    const pa = adapterByTable.get(a.table_name)?.pullOrder ?? 0;
    const pb = adapterByTable.get(b.table_name)?.pullOrder ?? 0;
    return pb - pa;
  });

  for (const tombstone of ordered) {
    const adapter = adapterByTable.get(tombstone.table_name);
    if (!adapter) {
      await db.runAsync(
        'DELETE FROM sync_tombstones WHERE table_name = ? AND row_key = ?',
        [tombstone.table_name, tombstone.row_key]
      );
      continue;
    }
    await deleteRemoteRow(client, adapter, tombstone.row_key);
    await client.from('sync_tombstones').upsert(
      {
        user_id: userId,
        table_name: tombstone.table_name,
        row_key: tombstone.row_key,
        deleted_at: tombstone.deleted_at,
      },
      { onConflict: 'user_id,table_name,row_key' }
    );
    await db.runAsync(
      'DELETE FROM sync_tombstones WHERE table_name = ? AND row_key = ?',
      [tombstone.table_name, tombstone.row_key]
    );
  }
  return ordered.length;
}

export interface PushResult {
  pushed: number;
  tombstones: number;
  settingsPushed: number;
}

async function pushSettings(
  client: SupabaseClient,
  db: SQLiteDatabase,
  userId: string
): Promise<number> {
  let pushed = 0;
  for (const key of SYNC_SETTINGS_KEYS) {
    const local = await db.getFirstAsync<{ value: string; updated_at: string | null }>(
      'SELECT value, updated_at FROM settings WHERE key = ?',
      [key]
    );
    if (!local) {
      continue;
    }
    const { data, error: fetchError } = await client
      .from('settings')
      .select('updated_at')
      .eq('key', key)
      .maybeSingle();
    if (fetchError) {
      throw new Error(`Settings push failed for ${key}: ${fetchError.message}`);
    }
    const localUpdatedAt = local.updated_at ?? new Date().toISOString();
    if (data && !isRemoteNewer(localUpdatedAt, data.updated_at as string | null)) {
      continue;
    }
    const { error: upsertError } = await client.from('settings').upsert(
      {
        user_id: userId,
        key,
        value: local.value,
        updated_at: localUpdatedAt,
      },
      { onConflict: 'user_id,key' }
    );
    if (upsertError) {
      throw new Error(`Settings push failed for ${key}: ${upsertError.message}`);
    }
    pushed += 1;
  }
  return pushed;
}

export async function pushChanges(
  client: SupabaseClient,
  db: SQLiteDatabase,
  full = false
): Promise<PushResult> {
  const userId = await getSupabaseUserId();
  if (!userId) {
    throw new SyncAuthError('You must be signed in to sync.');
  }

  const maps = await loadFkMaps(db);
  const entriesByTable = await buildEntries(db, full);
  const adapterByTable = new Map(COMPLETE_ADAPTERS.map((a) => [a.localTable, a]));
  let pushed = 0;
  for (const table of COMPLETE_ADAPTERS.map((a) => a.localTable)) {
    for (const entry of entriesByTable.get(table) ?? []) {
      const adapter = adapterByTable.get(entry.table_name);
      if (!adapter) {
        continue;
      }
      await pushRow(client, db, adapter, entry, userId, maps);
      pushed += 1;
    }
  }

  const tombstones = await pushTombstones(client, db, userId);
  const settingsPushed = await pushSettings(client, db, userId);
  return { pushed, tombstones, settingsPushed };
}