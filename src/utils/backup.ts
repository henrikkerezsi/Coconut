import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { backupDatabaseAsync, openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';
import dayjs from 'dayjs';
import { getDatabase, resetDatabase } from '../database/database';
import { BACKUP_EXTENSION } from './date';
import { toFilePath } from './paths';

export const BACKUP_MIME_TYPE = 'application/x-sqlite3';

/**
 * Serializes the full database into a backup file in the app cache and
 * returns the file. The backup is a complete SQLite database file.
 */
export async function createBackupFile(): Promise<File> {
  const db = await getDatabase();
  const bytes = await db.serializeAsync();
  const name = `coconut-backup-${dayjs().format('YYYY-MM-DD_HH-mm-ss')}.${BACKUP_EXTENSION}`;
  const file = new File(Paths.cache, name);
  file.create({ intermediates: true, overwrite: true });
  file.write(bytes);
  return file;
}

export async function shareBackup(): Promise<boolean> {
  if (!(await Sharing.isAvailableAsync())) {
    return false;
  }
  const file = await createBackupFile();
  await Sharing.shareAsync(file.uri, {
    mimeType: BACKUP_MIME_TYPE,
    dialogTitle: 'Coconut backup',
  });
  return true;
}

/**
 * Copies the picked backup into the app database using SQLite's online backup
 * API. The picked file is first staged in the app cache (which expo-file-system
 * is allowed to write to) and opened as a database, so the restore does not
 * depend on expo-file-system having write access to the SQLite directory.
 */
export async function restoreFromBackup(fileUri: string): Promise<void> {
  const source = new File(fileUri);
  const bytes = await source.bytes();

  const tempName = `coconut-restore-${Date.now()}.${BACKUP_EXTENSION}`;
  const tempFile = new File(Paths.cache, tempName);
  tempFile.create({ intermediates: true, overwrite: true });
  tempFile.write(bytes);

  let tempDb: SQLiteDatabase | null = null;
  try {
    tempDb = await openDatabaseAsync(tempName, {}, toFilePath(Paths.cache.uri));
    const db = await getDatabase();
    await backupDatabaseAsync({ sourceDatabase: tempDb, destDatabase: db });
  } finally {
    await tempDb?.closeAsync();
    if (tempFile.exists) {
      tempFile.delete();
    }
  }

  await resetDatabase();
}

export async function pickBackupFile(): Promise<File | null> {
  const result = await File.pickFileAsync({
    mimeTypes: [BACKUP_MIME_TYPE, 'application/octet-stream'],
  });
  if (result.canceled) {
    return null;
  }
  return result.result;
}