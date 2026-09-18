import type { SQLiteDatabase } from 'expo-sqlite';

import { getDatabase } from '../database/database';
import { getSyncState, updateSyncState } from '../database/syncState';
import { reconcileSharedTransactions } from '../database/sharedLinking';
import { pushChanges, type PushResult } from './push';
import { pullChanges, type PullResult } from './pull';
import { pushSharedChanges, pullSharedChanges, type SharedPushResult, type SharedPullResult } from './shared';
import { getSupabaseSessionUser, getClient, SyncAuthError } from './supabase';
import { nowIso } from './time';

const EPOCH = '1970-01-01T00:00:00.000Z';

export interface SyncOutcome {
  pushed: PushResult;
  pulled: PullResult;
  sharedPushed: SharedPushResult;
  sharedPulled: SharedPullResult;
}

let syncInProgress: Promise<SyncOutcome | null> | null = null;

export async function isSyncRunning(): Promise<boolean> {
  return syncInProgress !== null;
}

export async function syncNow(db?: SQLiteDatabase): Promise<SyncOutcome | null> {
  if (syncInProgress) {
    return syncInProgress;
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
      const sharedPushed = await pushSharedChanges(client, database);
      const sharedPulled = await pullSharedChanges(client, database);
      await reconcileSharedTransactions(user.id, database);
      const pushResult = await pushChanges(client, database, true);
      const since = state.lastSyncAt ?? EPOCH;
      const pullResult = await pullChanges(client, database, since);
      await updateSyncState({
        lastSyncAt: nowIso(),
        lastSyncStatus: 'success',
      });
      return { pushed: pushResult, pulled: pullResult, sharedPushed, sharedPulled };
    } catch (error) {
      if (error instanceof SyncAuthError) {
        return null;
      }
      const message = error instanceof Error ? error.message : 'Unknown sync error';
      await updateSyncState({ lastSyncStatus: 'error' });
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