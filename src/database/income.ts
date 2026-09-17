import type { SQLiteDatabase } from 'expo-sqlite';
import type { Income, MonthKey } from '../models';
import { monthKeyOf } from '../utils/date';
import { getDatabase } from './database';

export interface IncomeInput {
  date: string;
  amountCents: number;
  description: string;
  note: string | null;
}

interface IncomeRow {
  id: number;
  month_key: MonthKey;
  date: string;
  amount_cents: number;
  description: string;
  note: string | null;
}

const LIST_COLUMNS = 'id, month_key, date, amount_cents, description, note';

function rowToIncome(row: IncomeRow): Income {
  return {
    id: row.id,
    monthKey: row.month_key,
    date: row.date,
    amountCents: row.amount_cents,
    description: row.description,
    note: row.note,
  };
}

export async function createIncome(
  input: IncomeInput,
  db?: SQLiteDatabase
): Promise<number> {
  const database = db ?? (await getDatabase());
  const monthKey = monthKeyOf(input.date);
  const result = await database.runAsync(
    `INSERT INTO income (month_key, date, amount_cents, description, note)
     VALUES (?, ?, ?, ?, ?)`,
    [monthKey, input.date, input.amountCents, input.description, input.note]
  );
  return result.lastInsertRowId;
}

export async function updateIncome(
  id: number,
  input: IncomeInput,
  db?: SQLiteDatabase
): Promise<void> {
  const database = db ?? (await getDatabase());
  const monthKey = monthKeyOf(input.date);
  await database.runAsync(
    `UPDATE income SET month_key = ?, date = ?, amount_cents = ?, description = ?, note = ?
     WHERE id = ?`,
    [monthKey, input.date, input.amountCents, input.description, input.note, id]
  );
}

export async function deleteIncome(id: number, db?: SQLiteDatabase): Promise<void> {
  const database = db ?? (await getDatabase());
  await database.runAsync('DELETE FROM income WHERE id = ?', [id]);
}

export async function getIncome(
  id: number,
  db?: SQLiteDatabase
): Promise<Income | null> {
  const database = db ?? (await getDatabase());
  const row = await database.getFirstAsync<IncomeRow>(
    'SELECT * FROM income WHERE id = ?',
    [id]
  );
  return row ? rowToIncome(row) : null;
}

export async function getMonthIncome(
  monthKey: MonthKey,
  db?: SQLiteDatabase
): Promise<Income[]> {
  const database = db ?? (await getDatabase());
  const rows = await database.getAllAsync<IncomeRow>(
    `SELECT ${LIST_COLUMNS} FROM income WHERE month_key = ? ORDER BY date DESC, id DESC`,
    [monthKey]
  );
  return rows.map(rowToIncome);
}

export async function getRecentIncome(
  limit: number,
  db?: SQLiteDatabase
): Promise<Income[]> {
  const database = db ?? (await getDatabase());
  const rows = await database.getAllAsync<IncomeRow>(
    `SELECT ${LIST_COLUMNS} FROM income ORDER BY date DESC, id DESC LIMIT ?`,
    [limit]
  );
  return rows.map(rowToIncome);
}

export async function getAllIncome(db?: SQLiteDatabase): Promise<Income[]> {
  const database = db ?? (await getDatabase());
  const rows = await database.getAllAsync<IncomeRow>(
    `SELECT ${LIST_COLUMNS} FROM income ORDER BY date ASC, id ASC`
  );
  return rows.map(rowToIncome);
}