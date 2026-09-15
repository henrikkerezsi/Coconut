import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import dayjs from 'dayjs';
import { getDatabase, resetDatabase } from '../database/database';
import { BACKUP_EXTENSION } from './date';

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
 * Replaces the app database with the given backup file content.
 * The app database is closed first, the file is overwritten, and the
 * database connection is reopened.
 */
export async function restoreFromBackup(fileUri: string): Promise<void> {
  const source = new File(fileUri);
  const bytes = await source.bytes();

  const db = await getDatabase();
  await db.closeAsync();

  const target = new File(db.databasePath);
  target.create({ intermediates: true, overwrite: true });
  target.write(bytes);

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