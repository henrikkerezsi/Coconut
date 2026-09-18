import type { SQLiteDatabase } from 'expo-sqlite';
import dayjs from 'dayjs';
import type { SharedPeriod } from '../models';
import { DAYJS_STORE_DATE_FORMAT } from '../utils/date';
import { getDatabase } from './database';

interface SharedPeriodRow {
  id: number;
  uuid: string | null;
  space_id: number;
  start_date: string;
  end_date: string | null;
  status: 'open' | 'closed';
  created_at: string;
  updated_at: string | null;
}

function rowToPeriod(row: SharedPeriodRow): SharedPeriod {
  return {
    id: row.id,
    uuid: row.uuid,
    spaceId: row.space_id,
    startDate: row.start_date,
    endDate: row.end_date,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function todayIso(): string {
  return dayjs().format(DAYJS_STORE_DATE_FORMAT);
}

export async function getSharedPeriods(
  spaceId: number,
  db?: SQLiteDatabase
): Promise<SharedPeriod[]> {
  const database = db ?? (await getDatabase());
  const rows = await database.getAllAsync<SharedPeriodRow>(
    'SELECT * FROM shared_periods WHERE space_id = ? ORDER BY start_date DESC, id DESC',
    [spaceId]
  );
  return rows.map(rowToPeriod);
}

export async function getOpenPeriod(
  spaceId: number,
  db?: SQLiteDatabase
): Promise<SharedPeriod | null> {
  const database = db ?? (await getDatabase());
  const row = await database.getFirstAsync<SharedPeriodRow>(
    `SELECT * FROM shared_periods WHERE space_id = ? AND status = 'open' ORDER BY id DESC LIMIT 1`,
    [spaceId]
  );
  return row ? rowToPeriod(row) : null;
}

export async function getPeriod(
  id: number,
  db?: SQLiteDatabase
): Promise<SharedPeriod | null> {
  const database = db ?? (await getDatabase());
  const row = await database.getFirstAsync<SharedPeriodRow>(
    'SELECT * FROM shared_periods WHERE id = ?',
    [id]
  );
  return row ? rowToPeriod(row) : null;
}

export async function ensureOpenPeriod(
  spaceId: number,
  db?: SQLiteDatabase
): Promise<SharedPeriod> {
  const database = db ?? (await getDatabase());
  const existing = await getOpenPeriod(spaceId, database);
  if (existing) {
    return existing;
  }
  const lastRow = await database.getFirstAsync<{ end_date: string | null }>(
    `SELECT end_date FROM shared_periods
      WHERE space_id = ? AND status = 'closed' AND end_date IS NOT NULL
      ORDER BY end_date DESC, id DESC LIMIT 1`,
    [spaceId]
  );
  const startDate = lastRow?.end_date ?? todayIso();
  const result = await database.runAsync(
    `INSERT INTO shared_periods (space_id, start_date, status) VALUES (?, ?, 'open')`,
    [spaceId, startDate]
  );
  const created = await getPeriod(result.lastInsertRowId, database);
  if (!created) {
    throw new Error('Failed to create shared period');
  }
  return created;
}

export async function closePeriod(
  periodId: number,
  endDate: string,
  db?: SQLiteDatabase
): Promise<void> {
  const database = db ?? (await getDatabase());
  await database.runAsync(
    `UPDATE shared_periods SET status = 'closed', end_date = ? WHERE id = ?`,
    [endDate, periodId]
  );
}
