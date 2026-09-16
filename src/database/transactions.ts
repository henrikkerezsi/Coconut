import type { SQLiteDatabase } from 'expo-sqlite';
import type { MonthKey, Transaction } from '../models';
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
}

function rowToTransaction(row: TransactionRow): Transaction {
  return {
    id: row.id,
    monthKey: row.month_key,
    date: row.date,
    amountCents: row.amount_cents,
    budgetId: row.budget_id,
    merchant: row.merchant,
    note: row.note,
  };
}

export interface TransactionInput {
  date: string;
  amountCents: number;
  budgetId: number | null;
  merchant: string;
  note: string | null;
}

export async function createTransaction(
  input: TransactionInput,
  db?: SQLiteDatabase
): Promise<number> {
  const database = db ?? (await getDatabase());
  const monthKey = monthKeyOf(input.date);
  const result = await database.runAsync(
    `INSERT INTO transactions (month_key, date, amount_cents, budget_id, merchant, note)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [monthKey, input.date, input.amountCents, input.budgetId, input.merchant, input.note]
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
    `UPDATE transactions SET month_key = ?, date = ?, amount_cents = ?, budget_id = ?, merchant = ?, note = ?
     WHERE id = ?`,
    [monthKey, input.date, input.amountCents, input.budgetId, input.merchant, input.note, id]
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
    'SELECT * FROM transactions WHERE month_key = ? ORDER BY date DESC, id DESC',
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
    'SELECT * FROM transactions ORDER BY date DESC, id DESC LIMIT ?',
    [limit]
  );
  return rows.map(rowToTransaction);
}

export async function getAllTransactions(db?: SQLiteDatabase): Promise<Transaction[]> {
  const database = db ?? (await getDatabase());
  const rows = await database.getAllAsync<TransactionRow>(
    'SELECT * FROM transactions ORDER BY date ASC, id ASC'
  );
  return rows.map(rowToTransaction);
}