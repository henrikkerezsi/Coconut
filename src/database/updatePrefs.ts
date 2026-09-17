import type { SQLiteDatabase } from 'expo-sqlite';
import { getDatabase } from './database';

const IGNORED_RELEASE_VERSION_KEY = 'ignored_release_version';

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