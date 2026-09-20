import type { SupabaseClient } from '@supabase/supabase-js';
import type { SQLiteDatabase, SQLiteBindValue } from 'expo-sqlite';

import { withPullGuard } from '../database/syncMeta';
import {
  COMPLETE_ADAPTERS,
  SYNC_SETTINGS_KEYS,
  type SyncTableAdapter,
} from './serialize';
import { getSupabaseUserId, SyncAuthError } from './supabase';
import { isRemoteNewer } from './time';

function toBindValue(value: unknown): SQLiteBindValue {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === 'string' || typeof value === 'number') {
    return value;
  }
  return String(value);
}

interface FkMaps {
  budgetIdByUuid: Map<string, number | null>;
  fixedExpenseIdByUuid: Map<string, number | null>;
}

async function loadFkMaps(db: SQLiteDatabase): Promise<FkMaps> {
  const [budgets, fixedExpenses] = await Promise.all([
    db.getAllAsync<{ uuid: string; id: number }>(
      'SELECT uuid, id FROM budgets WHERE uuid IS NOT NULL'
    ),
    db.getAllAsync<{ uuid: string; id: number }>(
      'SELECT uuid, id FROM fixed_expenses WHERE uuid IS NOT NULL'
    ),
  ]);
  return {
    budgetIdByUuid: new Map(budgets.map((row) => [row.uuid, row.id])),
    fixedExpenseIdByUuid: new Map(fixedExpenses.map((row) => [row.uuid, row.id])),
  };
}

function pullFkResolver(maps: FkMaps) {
  return (remoteField: string, parentUuid: string | null): string | number | null => {
    if (parentUuid === null || parentUuid === undefined) {
      return null;
    }
    if (remoteField === 'budget_uuid') {
      return maps.budgetIdByUuid.get(parentUuid) ?? null;
    }
    if (remoteField === 'fixed_expense_uuid') {
      return maps.fixedExpenseIdByUuid.get(parentUuid) ?? null;
    }
    return null;
  };
}

// Local FK columns that are nullable. When the referenced parent uuid is
// missing locally, the child is applied with a NULL key (lossless, mirrors the
// remote ON DELETE SET NULL semantics) instead of being dropped permanently by
// the incremental watermark. NOT NULL FK children keep skipping: an instance
// without its parent is meaningless and a NULL would violate the column.
const NULLABLE_FK_LOCAL_COLUMNS = new Set<string>(['budget_id']);

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
    if (
      remoteValue != null &&
      values[field.local] == null &&
      !NULLABLE_FK_LOCAL_COLUMNS.has(field.local)
    ) {
      return true;
    }
  }
  return false;
}

function toSetSql(
  values: Record<string, unknown>
): { sql: string; params: SQLiteBindValue[] } {
  const columns = Object.keys(values);
  return {
    sql: columns.map((col) => `${col} = ?`).join(', '),
    params: columns.map((col) => toBindValue(values[col])),
  };
}

async function findNaturalMatch(
  db: SQLiteDatabase,
  adapter: SyncTableAdapter,
  values: Record<string, unknown>
): Promise<{ id: number; uuid: string; updated_at: string | null } | null> {
  const naturalKeys = adapter.naturalKeys ?? [];
  if (naturalKeys.length === 0) {
    return null;
  }
  const where = naturalKeys.map((col) => `${col} = ?`).join(' AND ');
  const params = naturalKeys.map((col) => toBindValue(values[col]));
  return db.getFirstAsync<{ id: number; uuid: string; updated_at: string | null }>(
    `SELECT id, uuid, updated_at FROM ${adapter.localTable} WHERE ${where} LIMIT 1`,
    params
  );
}

function captureInsertedParent(maps: FkMaps, adapter: SyncTableAdapter, values: Record<string, unknown>, id: number): void {
  const uuid = values.uuid as string | null;
  if (!uuid) {
    return;
  }
  if (adapter.localTable === 'budgets') {
    maps.budgetIdByUuid.set(uuid, id);
  } else if (adapter.localTable === 'fixed_expenses') {
    maps.fixedExpenseIdByUuid.set(uuid, id);
  }
}

async function applyRemoteRow(
  db: SQLiteDatabase,
  adapter: SyncTableAdapter,
  remote: Record<string, unknown>,
  maps: FkMaps
): Promise<void> {
  const uuid = (remote.uuid as string) ?? '';
  const remoteUpdatedAt = (remote.updated_at as string | null) ?? null;
  const values: Record<string, unknown> = adapter.fromRemote(remote, pullFkResolver(maps));
  values.updated_at = remoteUpdatedAt;

  if (hasUnresolvedFk(adapter, remote, values)) {
    return;
  }

  if (adapter.identityColumn === 'month_key') {
    const monthKey = values.month_key as string;
    if (!monthKey) {
      return;
    }
    const local = await db.getFirstAsync<{ updated_at: string | null }>(
      'SELECT updated_at FROM months WHERE month_key = ?',
      [monthKey]
    );
    if (local && !isRemoteNewer(local.updated_at, remoteUpdatedAt)) {
      return;
    }
    values.uuid = uuid;
    if (local) {
      const { sql, params } = toSetSql(values);
      await db.runAsync(`UPDATE months SET ${sql} WHERE month_key = ?`, [
        ...params,
        monthKey,
      ]);
    } else {
      const columns = Object.keys(values);
      await db.runAsync(
        `INSERT INTO months (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`,
        columns.map((col) => toBindValue(values[col]))
      );
    }
    return;
  }

  const existing = await db.getFirstAsync<{ id: number; uuid: string; updated_at: string | null }>(
    `SELECT id, uuid, updated_at FROM ${adapter.localTable} WHERE uuid = ?`,
    [uuid]
  );
  const naturalMatch = existing ? null : await findNaturalMatch(db, adapter, values);
  const target = existing ?? naturalMatch;

  if (target) {
    if (!isRemoteNewer(target.updated_at, remoteUpdatedAt)) {
      return;
    }
    values.uuid = target.uuid;
    const { sql, params } = toSetSql(values);
    await db.runAsync(`UPDATE ${adapter.localTable} SET ${sql} WHERE uuid = ?`, [
      ...params,
      toBindValue(values.uuid),
    ]);
    return;
  }

  values.uuid = uuid;
  const columns = Object.keys(values);
  const result = await db.runAsync(
    `INSERT INTO ${adapter.localTable} (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`,
    columns.map((col) => toBindValue(values[col]))
  );
  captureInsertedParent(maps, adapter, values, result.lastInsertRowId);
}

async function fetchRemoteRows(
  client: SupabaseClient,
  remoteTable: string,
  since: string
): Promise<Record<string, unknown>[]> {
  const { data, error } = await client
    .from(remoteTable)
    .select('*')
    .gt('updated_at', since)
    .order('updated_at', { ascending: true });
  if (error) {
    throw new Error(`Pull failed for ${remoteTable}: ${error.message}`);
  }
  return (data ?? []) as Record<string, unknown>[];
}

async function applyRemoteTombstones(
  db: SQLiteDatabase,
  client: SupabaseClient,
  since: string
): Promise<number> {
  const { data, error } = await client
    .from('sync_tombstones')
    .select('table_name, row_key')
    .gt('deleted_at', since);
  if (error) {
    throw new Error(`Pull of tombstones failed: ${error.message}`);
  }
  const adapterByTable = new Map(COMPLETE_ADAPTERS.map((a) => [a.localTable, a]));
  let applied = 0;
  for (const tomb of data ?? []) {
    const adapter = adapterByTable.get(tomb.table_name as string);
    if (!adapter) {
      continue;
    }
    if (adapter.identityColumn === 'month_key') {
      await db.runAsync('DELETE FROM months WHERE month_key = ?', [tomb.row_key]);
    } else {
      await db.runAsync(`DELETE FROM ${adapter.localTable} WHERE uuid = ?`, [
        tomb.row_key,
      ]);
    }
    await db.runAsync('DELETE FROM sync_outbox WHERE table_name = ? AND row_key = ?', [
      tomb.table_name,
      tomb.row_key,
    ]);
    applied += 1;
  }
  return applied;
}

async function pullSettings(
  db: SQLiteDatabase,
  client: SupabaseClient,
  since: string
): Promise<number> {
  const { data, error } = await client
    .from('settings')
    .select('key, value, updated_at')
    .in('key', SYNC_SETTINGS_KEYS)
    .gt('updated_at', since);
  if (error) {
    throw new Error(`Pull of settings failed: ${error.message}`);
  }
  let applied = 0;
  for (const row of data ?? []) {
    const key = row.key as string;
    const value = (row.value as string) ?? '';
    const updatedAt = (row.updated_at as string | null) ?? null;
    const local = await db.getFirstAsync<{ value: string; updated_at: string | null }>(
      'SELECT value, updated_at FROM settings WHERE key = ?',
      [key]
    );
    if (local && !isRemoteNewer(local.updated_at, updatedAt)) {
      continue;
    }
    await db.runAsync(
      `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)
       ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      [key, value, updatedAt]
    );
    applied += 1;
  }
  return applied;
}

export interface PullResult {
  pulled: number;
  tombstones: number;
  settingsPulled: number;
}

export async function pullChanges(
  client: SupabaseClient,
  db: SQLiteDatabase,
  since: string
): Promise<PullResult> {
  const userId = await getSupabaseUserId();
  if (!userId) {
    throw new SyncAuthError('You must be signed in to sync.');
  }

  const maps = await loadFkMaps(db);
  let pulled = 0;
  let tombstones = 0;
  let settingsPulled = 0;

  await withPullGuard(db, async () => {
    tombstones = await applyRemoteTombstones(db, client, since);

    for (const adapter of COMPLETE_ADAPTERS) {
      const remoteRows = await fetchRemoteRows(client, adapter.remoteTable, since);
      for (const remoteRow of remoteRows) {
        await applyRemoteRow(db, adapter, remoteRow, maps);
        pulled += 1;
      }
    }

    settingsPulled = await pullSettings(db, client, since);
  });

  return { pulled, tombstones, settingsPulled };
}