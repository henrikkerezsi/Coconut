import type { SQLiteDatabase } from 'expo-sqlite';
import { getMeta, removeMeta, setMeta } from './syncMeta';

const SELECTED_SHARED_SPACE_KEY = 'shared_selected_space_uuid';

export async function getSelectedSpaceUuid(db?: SQLiteDatabase): Promise<string | null> {
  return getMeta(SELECTED_SHARED_SPACE_KEY, db);
}

export async function setSelectedSpaceUuid(
  uuid: string | null,
  db?: SQLiteDatabase
): Promise<void> {
  if (uuid) {
    await setMeta(SELECTED_SHARED_SPACE_KEY, uuid, db);
  } else {
    await removeMeta(SELECTED_SHARED_SPACE_KEY, db);
  }
}
