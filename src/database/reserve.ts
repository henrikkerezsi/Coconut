import type { SQLiteDatabase } from 'expo-sqlite';
import type { MerchantSuggestion, MonthKey, ReserveTransfer } from '../models';
import { getDatabase } from './database';

/**
 * Records the reserve movement the app applied when a month was closed. Rows
 * are written only by the month-closing action; there is no manual transfer.
 */
export async function createReserveTransfer(
  monthKey: MonthKey,
  amountCents: number,
  direction: ReserveTransfer['direction'],
  note: string | null,
  db?: SQLiteDatabase
): Promise<number> {
  const database = db ?? (await getDatabase());
  const result = await database.runAsync(
    `INSERT INTO reserve_transfers (month_key, amount_cents, direction, note)
     VALUES (?, ?, ?, ?)`,
    [monthKey, amountCents, direction, note]
  );
  return result.lastInsertRowId;
}

interface ReserveTransferRow {
  id: number;
  month_key: MonthKey;
  amount_cents: number;
  direction: ReserveTransfer['direction'];
  note: string | null;
}

function rowToTransfer(row: ReserveTransferRow): ReserveTransfer {
  return {
    id: row.id,
    monthKey: row.month_key,
    amountCents: row.amount_cents,
    direction: row.direction,
    note: row.note,
  };
}

/**
 * The reserve movements the app applied when closing months, newest first. This
 * is the audit trail of every automatic adjustment ever made: one row per closed
 * month, never a row the user typed.
 */
export async function getReserveTransfers(
  limit = 60,
  db?: SQLiteDatabase
): Promise<ReserveTransfer[]> {
  const database = db ?? (await getDatabase());
  const rows = await database.getAllAsync<ReserveTransferRow>(
    `SELECT id, month_key, amount_cents, direction, note
       FROM reserve_transfers
      ORDER BY month_key DESC, id DESC
      LIMIT ?`,
    [limit]
  );
  return rows.map(rowToTransfer);
}

export async function upsertMerchantSuggestion(
  merchant: string,
  budgetId: number | null,
  db?: SQLiteDatabase
): Promise<void> {
  if (budgetId === null || budgetId === undefined) {
    return;
  }
  const database = db ?? (await getDatabase());
  const existing = await database.getFirstAsync<{ budget_id: number }>(
    'SELECT budget_id FROM merchant_suggestions WHERE merchant = ? AND budget_id = ?',
    [merchant, budgetId]
  );
  if (existing) {
    await database.runAsync(
      `UPDATE merchant_suggestions SET use_count = use_count + 1, last_used = datetime('now')
       WHERE merchant = ? AND budget_id = ?`,
      [merchant, budgetId]
    );
  } else {
    await database.runAsync(
      `INSERT INTO merchant_suggestions (merchant, budget_id, use_count, last_used)
       VALUES (?, ?, 1, datetime('now'))`,
      [merchant, budgetId]
    );
  }
}

export async function getMerchantSuggestions(
  merchant: string,
  db?: SQLiteDatabase
): Promise<MerchantSuggestion[]> {
  const database = db ?? (await getDatabase());
  const rows = await database.getAllAsync<{
    merchant: string;
    budget_id: number;
    use_count: number;
  }>(
    `SELECT merchant, budget_id, use_count FROM merchant_suggestions
     WHERE merchant = ? ORDER BY use_count DESC`,
    [merchant]
  );
  return rows.map((row) => ({
    merchant: row.merchant,
    budgetId: row.budget_id,
    useCount: row.use_count,
  }));
}