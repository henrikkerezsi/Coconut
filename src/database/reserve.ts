import type { SQLiteDatabase } from 'expo-sqlite';
import type { MerchantSuggestion, MonthKey, ReserveTransfer } from '../models';
import { getDatabase } from './database';

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

export async function deleteReserveTransfer(id: number, db?: SQLiteDatabase): Promise<void> {
  const database = db ?? (await getDatabase());
  await database.runAsync('DELETE FROM reserve_transfers WHERE id = ?', [id]);
}

interface ReserveTransferRow {
  id: number;
  month_key: MonthKey;
  amount_cents: number;
  direction: string;
  note: string | null;
}

function rowToTransfer(row: ReserveTransferRow): ReserveTransfer {
  return {
    id: row.id,
    monthKey: row.month_key,
    amountCents: row.amount_cents,
    direction: row.direction === 'to-reserve' ? 'to-reserve' : 'to-month',
    note: row.note,
  };
}

export async function getMonthTransfers(
  monthKey: MonthKey,
  db?: SQLiteDatabase
): Promise<ReserveTransfer[]> {
  const database = db ?? (await getDatabase());
  const rows = await database.getAllAsync<ReserveTransferRow>(
    `SELECT id, month_key, amount_cents, direction, note FROM reserve_transfers
     WHERE month_key = ? ORDER BY id ASC`,
    [monthKey]
  );
  return rows.map(rowToTransfer);
}

export async function getAllTransfers(db?: SQLiteDatabase): Promise<ReserveTransfer[]> {
  const database = db ?? (await getDatabase());
  const rows = await database.getAllAsync<ReserveTransferRow>(
    `SELECT id, month_key, amount_cents, direction, note FROM reserve_transfers
     ORDER BY month_key ASC, id ASC`
  );
  return rows.map(rowToTransfer);
}

export async function upsertMerchantSuggestion(
  merchant: string,
  budgetId: number,
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