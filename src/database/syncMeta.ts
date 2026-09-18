import type { SQLiteDatabase } from 'expo-sqlite';
import { getDatabase } from './database';

export const PULL_IN_PROGRESS_KEY = 'pull_in_progress';
const AUTH_SESSION_PREFIX = 'auth_session_';

export async function getMeta(key: string, db?: SQLiteDatabase): Promise<string | null> {
  const database = db ?? (await getDatabase());
  const row = await database.getFirstAsync<{ value: string }>(
    'SELECT value FROM sync_meta WHERE key = ?',
    [key]
  );
  return row?.value ?? null;
}

export async function setMeta(key: string, value: string, db?: SQLiteDatabase): Promise<void> {
  const database = db ?? (await getDatabase());
  await database.runAsync(
    `INSERT INTO sync_meta (key, value) VALUES (?, ?)
     ON CONFLICT (key) DO UPDATE SET value = excluded.value`,
    [key, value]
  );
}

export async function removeMeta(key: string, db?: SQLiteDatabase): Promise<void> {
  const database = db ?? (await getDatabase());
  await database.runAsync('DELETE FROM sync_meta WHERE key = ?', [key]);
}

async function setPullFlag(flag: boolean, db?: SQLiteDatabase): Promise<void> {
  await setMeta(PULL_IN_PROGRESS_KEY, flag ? '1' : '0', db);
}

export async function withPullGuard<T>(
  db: SQLiteDatabase,
  fn: () => Promise<T> | T
): Promise<T> {
  await setPullFlag(true, db);
  try {
    return await fn();
  } finally {
    await setPullFlag(false, db);
  }
}

const AUTH_SESSION_KEY = (key: string): string => `${AUTH_SESSION_PREFIX}${key}`;

export const syncMetaAuthStorage = {
  async getItem(key: string): Promise<string | null> {
    return getMeta(AUTH_SESSION_KEY(key));
  },
  async setItem(key: string, value: string): Promise<void> {
    await setMeta(AUTH_SESSION_KEY(key), value);
  },
  async removeItem(key: string): Promise<void> {
    await removeMeta(AUTH_SESSION_KEY(key));
  },
};