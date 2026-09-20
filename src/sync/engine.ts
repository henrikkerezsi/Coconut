import type { SQLiteDatabase } from 'expo-sqlite';

import { getDatabase } from '../database/database';
import { getSyncState, updateSyncState } from '../database/syncState';
import { getMeta, setMeta } from '../database/syncMeta';
import { reconcileSharedTransactions } from '../database/sharedLinking';
import { pushChanges, type PushResult } from './push';
import { pullChanges, type PullResult } from './pull';
import { pushSharedChanges, pullSharedChanges, type SharedPushResult, type SharedPullResult } from './shared';
import { getSupabaseSessionUser, getClient, SyncAuthError } from './supabase';
import { nowIso } from './time';

const EPOCH = '1970-01-01T00:00:00.000Z';

/** Watermark for the incremental shared-only sync, kept in `sync_meta`. */
export const SHARED_LAST_SYNC_KEY = 'shared_last_sync_at';

export interface SyncOutcome {
  pushed: PushResult;
  pulled: PullResult;
  sharedPushed: SharedPushResult;
  sharedPulled: SharedPullResult;
}

export interface SharedQuickSyncResult {
  pushed: SharedPushResult;
  pulled: SharedPullResult;
}

let syncInProgress: Promise<SyncOutcome | null> | null = null;
let sharedSyncInProgress: Promise<SharedQuickSyncResult | null> | null = null;

export async function isSyncRunning(): Promise<boolean> {
  return syncInProgress !== null;
}

export async function isSharedSyncRunning(): Promise<boolean> {
  return sharedSyncInProgress !== null;
}

/**
 * Background, low-cost sync of just the shared tables.
 *
 * Pushes only the local outbox (no whole-database re-seed) and pulls only rows
 * changed since the last shared sync. This is the sync that runs on app open
 * and on pull-to-refresh on the shared tab; the heavy full `syncNow` stays
 * available in Settings for emergencies (re-seeding the remote, repairing
 * divergence, retrying failed migrations).
 */
export async function syncSharedChanges(db?: SQLiteDatabase): Promise<SharedQuickSyncResult | null> {
  if (sharedSyncInProgress) {
    return sharedSyncInProgress;
  }
  if (await isSyncRunning()) {
    return null;
  }
  sharedSyncInProgress = (async () => {
    const database = db ?? (await getDatabase());
    const state = await getSyncState(database);
    if (!state.enabled) {
      return null;
    }
    const user = await getSupabaseSessionUser();
    if (!user) {
      return null;
    }
    try {
      await updateSyncState({ lastSyncStatus: 'syncing' }, database);
      const client = await getClient();
      const pushed = await pushSharedChanges(client, database, user.id, { changesOnly: true });
      const since = await getMeta(SHARED_LAST_SYNC_KEY, database);
      const pulled = await pullSharedChanges(client, database, since ?? undefined);
      await reconcileSharedTransactions(user.id, database);
      await setMeta(SHARED_LAST_SYNC_KEY, nowIso(), database);
      await updateSyncState({ lastSyncStatus: 'success', lastSyncError: null }, database);
      return { pushed, pulled };
    } catch (error) {
      if (error instanceof SyncAuthError) {
        return null;
      }
      const message = error instanceof Error ? error.message : 'Unknown sync error';
      await updateSyncState({ lastSyncStatus: 'error', lastSyncError: message }, database);
      throw new SyncError(message);
    }
  })();
  try {
    return await sharedSyncInProgress;
  } finally {
    sharedSyncInProgress = null;
  }
}

export async function syncNow(db?: SQLiteDatabase): Promise<SyncOutcome | null> {
  if (syncInProgress) {
    return syncInProgress;
  }
  if (sharedSyncInProgress) {
    await sharedSyncInProgress;
  }
  syncInProgress = (async () => {
    const database = db ?? (await getDatabase());
    const state = await getSyncState(database);
    if (!state.enabled) {
      return null;
    }
    const user = await getSupabaseSessionUser();
    if (!user) {
      return null;
    }
    try {
      await updateSyncState({ lastSyncStatus: 'syncing' });
      const client = await getClient();
      // Always re-sync the whole local database so rows that existed before
      // change-capture triggers were installed still get uploaded.
      const sharedPushed = await pushSharedChanges(client, database, user.id);
      const sharedPulled = await pullSharedChanges(client, database);
      await reconcileSharedTransactions(user.id, database);
      const pushResult = await pushChanges(client, database, true);
      const since = state.lastSyncAt ?? EPOCH;
      const pullResult = await pullChanges(client, database, since);
      await setMeta(SHARED_LAST_SYNC_KEY, nowIso(), database);
      await updateSyncState({
        lastSyncAt: nowIso(),
        lastSyncStatus: 'success',
        lastSyncError: null,
      });
      return { pushed: pushResult, pulled: pullResult, sharedPushed, sharedPulled };
    } catch (error) {
      if (error instanceof SyncAuthError) {
        return null;
      }
      const message = error instanceof Error ? error.message : 'Unknown sync error';
      await updateSyncState({ lastSyncStatus: 'error', lastSyncError: message });
      throw new SyncError(message);
    }
  })();
  try {
    const outcome = await syncInProgress;
    return outcome;
  } finally {
    syncInProgress = null;
  }
}

export class SyncError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SyncError';
  }
}