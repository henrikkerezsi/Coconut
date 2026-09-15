import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';
import { DATABASE_NAME } from '../utils/date';
import { MIGRATIONS } from './migrations';

let dbPromise: Promise<SQLiteDatabase> | null = null;

export function getDatabase(): Promise<SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = openDatabaseAsync(DATABASE_NAME).then(async (db) => {
      await db.execAsync('PRAGMA journal_mode = WAL;');
      await migrate(db);
      return db;
    });
  }
  return dbPromise;
}

export async function resetDatabase(): Promise<void> {
  if (dbPromise) {
    const db = await dbPromise;
    await db.closeAsync();
    dbPromise = null;
  }
  dbPromise = getDatabase();
  await dbPromise;
}

export async function migrate(db: SQLiteDatabase): Promise<void> {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const currentVersion = row?.user_version ?? 0;
  const pending = MIGRATIONS.filter((migration) => migration.id > currentVersion).sort(
    (a, b) => a.id - b.id
  );
  for (const migration of pending) {
    await db.withTransactionAsync(async () => {
      await db.execAsync(migration.sql);
      await db.execAsync(`PRAGMA user_version = ${migration.id}`);
    });
  }
}