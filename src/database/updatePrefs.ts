import type { SQLiteDatabase } from 'expo-sqlite';
import { getDatabase } from './database';

const IGNORED_RELEASE_VERSION_KEY = 'ignored_release_version';
const CHECK_FOR_UPDATES_ON_START_KEY = 'check_for_updates_on_start';

export async function getIgnoredReleaseVersion(db?: SQLiteDatabase): Promise<string | null> {
  const database = db ?? (await getDatabase());
  const row = await database.getFirstAsync<{ value: string }>(
    'SELECT value FROM settings WHERE key = ?',
    [IGNORED_RELEASE_VERSION_KEY]
  );
  return row?.value || null;
}

export async function setIgnoredReleaseVersion(
  version: string,
  db?: SQLiteDatabase
): Promise<void> {
  const database = db ?? (await getDatabase());
  await database.runAsync(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value',
    [IGNORED_RELEASE_VERSION_KEY, version]
  );
}

export async function getCheckForUpdatesOnStart(db?: SQLiteDatabase): Promise<boolean> {
  const database = db ?? (await getDatabase());
  const row = await database.getFirstAsync<{ value: string }>(
    'SELECT value FROM settings WHERE key = ?',
    [CHECK_FOR_UPDATES_ON_START_KEY]
  );
  return row?.value === '1';
}

export async function setCheckForUpdatesOnStart(
  enabled: boolean,
  db?: SQLiteDatabase
): Promise<void> {
  const database = db ?? (await getDatabase());
  await database.runAsync(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value',
    [CHECK_FOR_UPDATES_ON_START_KEY, enabled ? '1' : '0']
  );
}