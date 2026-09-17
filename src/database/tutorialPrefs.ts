import type { SQLiteDatabase } from 'expo-sqlite';
import { getDatabase } from './database';

const TUTORIAL_SEEN_KEY = 'tutorial_seen';

export async function getTutorialSeen(db?: SQLiteDatabase): Promise<boolean> {
  const database = db ?? (await getDatabase());
  const row = await database.getFirstAsync<{ value: string }>(
    'SELECT value FROM settings WHERE key = ?',
    [TUTORIAL_SEEN_KEY]
  );
  return row?.value === '1';
}

export async function setTutorialSeen(db?: SQLiteDatabase): Promise<void> {
  const database = db ?? (await getDatabase());
  await database.runAsync(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value',
    [TUTORIAL_SEEN_KEY, '1']
  );
}