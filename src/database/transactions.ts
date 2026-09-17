import type { SQLiteDatabase } from 'expo-sqlite';
import type { Attachment, MonthKey, Transaction } from '../models';
import { monthKeyOf } from '../utils/date';
import { getDatabase } from './database';

interface TransactionRow {
  id: number;
  month_key: MonthKey;
  date: string;
  amount_cents: number;
  budget_id: number | null;
  merchant: string;
  note: string | null;
  attachment_name: string | null;
  attachment_mime: string | null;
  attachment: ArrayBuffer | Uint8Array | null;
}

const LIST_COLUMNS =
  'id, month_key, date, amount_cents, budget_id, merchant, note, created_at, attachment_name, attachment_mime';

function rowToTransaction(row: TransactionRow): Transaction {
  return {
    id: row.id,
    monthKey: row.month_key,
    date: row.date,
    amountCents: row.amount_cents,
    budgetId: row.budget_id,
    merchant: row.merchant,
    note: row.note,
    attachmentName: row.attachment_name ?? null,
    attachmentMime: row.attachment_mime ?? null,
    attachment: row.attachment ? new Uint8Array(row.attachment) : null,
  };
}

export interface TransactionInput {
  date: string;
  amountCents: number;
  budgetId: number | null;
  merchant: string;
  note: string | null;
  attachment: Attachment | null;
}

export async function createTransaction(
  input: TransactionInput,
  db?: SQLiteDatabase
): Promise<number> {
  const database = db ?? (await getDatabase());
  const monthKey = monthKeyOf(input.date);
  const result = await database.runAsync(
    `INSERT INTO transactions (month_key, date, amount_cents, budget_id, merchant, note, attachment_name, attachment_mime, attachment)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      monthKey,
      input.date,
      input.amountCents,
      input.budgetId,
      input.merchant,
      input.note,
      input.attachment?.name ?? null,
      input.attachment?.mime ?? null,
      input.attachment?.bytes ?? null,
    ]
  );
  return result.lastInsertRowId;
}

export async function updateTransaction(
  id: number,
  input: TransactionInput,
  db?: SQLiteDatabase
): Promise<void> {
  const database = db ?? (await getDatabase());
  const monthKey = monthKeyOf(input.date);
  await database.runAsync(
    `UPDATE transactions SET month_key = ?, date = ?, amount_cents = ?, budget_id = ?, merchant = ?, note = ?, attachment_name = ?, attachment_mime = ?, attachment = ?
     WHERE id = ?`,
    [
      monthKey,
      input.date,
      input.amountCents,
      input.budgetId,
      input.merchant,
      input.note,
      input.attachment?.name ?? null,
      input.attachment?.mime ?? null,
      input.attachment?.bytes ?? null,
      id,
    ]
  );
}

export async function deleteTransaction(id: number, db?: SQLiteDatabase): Promise<void> {
  const database = db ?? (await getDatabase());
  await database.runAsync('DELETE FROM transactions WHERE id = ?', [id]);
}

export async function getTransaction(
  id: number,
  db?: SQLiteDatabase
): Promise<Transaction | null> {
  const database = db ?? (await getDatabase());
  const row = await database.getFirstAsync<TransactionRow>(
    'SELECT * FROM transactions WHERE id = ?',
    [id]
  );
  return row ? rowToTransaction(row) : null;
}

export async function getMonthTransactions(
  monthKey: MonthKey,
  db?: SQLiteDatabase
): Promise<Transaction[]> {
  const database = db ?? (await getDatabase());
  const rows = await database.getAllAsync<TransactionRow>(
    `SELECT ${LIST_COLUMNS} FROM transactions WHERE month_key = ? ORDER BY date DESC, id DESC`,
    [monthKey]
  );
  return rows.map(rowToTransaction);
}

export async function getRecentTransactions(
  limit: number,
  db?: SQLiteDatabase
): Promise<Transaction[]> {
  const database = db ?? (await getDatabase());
  const rows = await database.getAllAsync<TransactionRow>(
    `SELECT ${LIST_COLUMNS} FROM transactions ORDER BY date DESC, id DESC LIMIT ?`,
    [limit]
  );
  return rows.map(rowToTransaction);
}

export async function getAllTransactions(db?: SQLiteDatabase): Promise<Transaction[]> {
  const database = db ?? (await getDatabase());
  const rows = await database.getAllAsync<TransactionRow>(
    `SELECT ${LIST_COLUMNS} FROM transactions ORDER BY date ASC, id ASC`
  );
  return rows.map(rowToTransaction);
}