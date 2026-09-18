import type { SQLiteDatabase } from 'expo-sqlite';
import type { SyncState, SyncStatus } from '../models';
import { getDatabase } from './database';

export const DEFAULT_SYNC_STATE: SyncState = {
  supabaseUrl: null,
  apiKey: null,
  enabled: false,
  lastSyncAt: null,
  lastSyncStatus: null,
};

interface SyncStateRow {
  supabase_url: string | null;
  api_key: string | null;
  enabled: number;
  last_sync_at: string | null;
  last_sync_status: SyncStatus | null;
}

function isSyncStatus(value: string | null): value is SyncStatus {
  return value === null || value === 'idle' || value === 'syncing' || value === 'success' || value === 'error';
}

function rowToSyncState(row: SyncStateRow): SyncState {
  return {
    supabaseUrl: row.supabase_url,
    apiKey: row.api_key,
    enabled: row.enabled === 1,
    lastSyncAt: row.last_sync_at,
    lastSyncStatus: isSyncStatus(row.last_sync_status) ? row.last_sync_status : null,
  };
}

export async function getSyncState(db?: SQLiteDatabase): Promise<SyncState> {
  const database = db ?? (await getDatabase());
  const row = await database.getFirstAsync<SyncStateRow>(
    'SELECT supabase_url, api_key, enabled, last_sync_at, last_sync_status FROM sync_state WHERE id = 1'
  );
  if (!row) {
    return { ...DEFAULT_SYNC_STATE };
  }
  return rowToSyncState(row);
}

export async function updateSyncState(
  patch: Partial<SyncState>,
  db?: SQLiteDatabase
): Promise<SyncState> {
  const database = db ?? (await getDatabase());
  const current = await getSyncState(database);
  const next: SyncState = { ...current, ...patch };
  await database.runAsync(
    `INSERT INTO sync_state (id, supabase_url, api_key, enabled, last_sync_at, last_sync_status)
     VALUES (1, ?, ?, ?, ?, ?)
     ON CONFLICT (id) DO UPDATE SET
       supabase_url = excluded.supabase_url,
       api_key = excluded.api_key,
       enabled = excluded.enabled,
       last_sync_at = excluded.last_sync_at,
       last_sync_status = excluded.last_sync_status`,
    [
      next.supabaseUrl,
      next.apiKey,
      next.enabled ? 1 : 0,
      next.lastSyncAt,
      next.lastSyncStatus,
    ]
  );
  return next;
}