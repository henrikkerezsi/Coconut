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

/**
 * Enforces the one-open-period-per-space invariant across synced copies.
 *
 * The invariant is normally maintained locally by `ensureOpenPeriod`, but two
 * devices can each open a period before the other's has synced (a close/reopen
 * race, or accepting an invite before the peer's period arrived). Both open
 * periods then land in every copy, and `getOpenPeriod` arbitrarily shows only
 * one of them while personal linked transactions still aggregate across both.
 *
 * This picks a deterministic winner per space (earliest start date, then
 * smallest uuid so every device agrees), re-points the losers' expenses to the
 * winner, and closes the losers with the winner's start date as end date. The
 * changes flow through the normal change-capture triggers, so the merged state
 * converges on the remote and on other members' devices.
 */
export async function consolidateOpenPeriods(db?: SQLiteDatabase): Promise<number> {
  const database = db ?? (await getDatabase());
  const spaces = await database.getAllAsync<{ id: number }>(
    `SELECT space_id AS id FROM shared_periods
      WHERE status = 'open'
      GROUP BY space_id
      HAVING COUNT(*) > 1`
  );
  let merged = 0;
  for (const space of spaces) {
    const open = await database.getAllAsync<{
      id: number;
      uuid: string | null;
      start_date: string;
    }>(
      `SELECT id, uuid, start_date FROM shared_periods
        WHERE space_id = ? AND status = 'open'
        ORDER BY start_date ASC, uuid ASC, id ASC`,
      [space.id]
    );
    const winner = open[0];
    if (!winner) {
      continue;
    }
    for (const loser of open.slice(1)) {
      await database.runAsync('UPDATE shared_expenses SET period_id = ? WHERE period_id = ?', [
        winner.id,
        loser.id,
      ]);
      await database.runAsync(
        `UPDATE shared_periods SET status = 'closed', end_date = ? WHERE id = ?`,
        [winner.start_date, loser.id]
      );
      merged += 1;
    }
  }
  return merged;
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
