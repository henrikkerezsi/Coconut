import type { SQLiteDatabase } from 'expo-sqlite';
import type { YearlySubscription } from '../models';
import { getDatabase } from './database';

interface YearlySubscriptionRow {
  id: number;
  name: string;
  yearly_amount_cents: number;
  monthly_amount_cents: number;
  started_month: string;
  billing_month: string;
  deduct_monthly: number;
  active: number;
  sort_order: number;
}

function rowToSubscription(row: YearlySubscriptionRow): YearlySubscription {
  return {
    id: row.id,
    name: row.name,
    yearlyAmountCents: row.yearly_amount_cents,
    monthlyAmountCents: row.monthly_amount_cents,
    startedMonth: row.started_month,
    billingMonth: row.billing_month,
    deductMonthly: row.deduct_monthly === 1,
    active: row.active === 1,
    sortOrder: row.sort_order,
  };
}

export type YearlySubscriptionInput = Omit<YearlySubscription, 'id'>;

export async function getAllYearlySubscriptions(
  db?: SQLiteDatabase
): Promise<YearlySubscription[]> {
  const database = db ?? (await getDatabase());
  const rows = await database.getAllAsync<YearlySubscriptionRow>(
    'SELECT * FROM yearly_subscriptions ORDER BY sort_order ASC, id ASC'
  );
  return rows.map(rowToSubscription);
}

export async function getActiveYearlySubscriptions(
  db?: SQLiteDatabase
): Promise<YearlySubscription[]> {
  const database = db ?? (await getDatabase());
  const rows = await database.getAllAsync<YearlySubscriptionRow>(
    'SELECT * FROM yearly_subscriptions WHERE active = 1 ORDER BY sort_order ASC, id ASC'
  );
  return rows.map(rowToSubscription);
}

export async function getYearlySubscription(
  id: number,
  db?: SQLiteDatabase
): Promise<YearlySubscription | null> {
  const database = db ?? (await getDatabase());
  const row = await database.getFirstAsync<YearlySubscriptionRow>(
    'SELECT * FROM yearly_subscriptions WHERE id = ?',
    [id]
  );
  return row ? rowToSubscription(row) : null;
}

export async function createYearlySubscription(
  input: YearlySubscriptionInput,
  db?: SQLiteDatabase
): Promise<number> {
  const database = db ?? (await getDatabase());
  const result = await database.runAsync(
    `INSERT INTO yearly_subscriptions
       (name, yearly_amount_cents, monthly_amount_cents, started_month, billing_month, deduct_monthly, active, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      input.name,
      input.yearlyAmountCents,
      input.monthlyAmountCents,
      input.startedMonth,
      input.billingMonth,
      input.deductMonthly ? 1 : 0,
      input.active ? 1 : 0,
      input.sortOrder,
    ]
  );
  return result.lastInsertRowId;
}

export async function updateYearlySubscription(
  id: number,
  input: YearlySubscriptionInput,
  db?: SQLiteDatabase
): Promise<void> {
  const database = db ?? (await getDatabase());
  await database.runAsync(
    `UPDATE yearly_subscriptions SET
       name = ?, yearly_amount_cents = ?, monthly_amount_cents = ?,
       started_month = ?, billing_month = ?, deduct_monthly = ?, active = ?, sort_order = ?
     WHERE id = ?`,
    [
      input.name,
      input.yearlyAmountCents,
      input.monthlyAmountCents,
      input.startedMonth,
      input.billingMonth,
      input.deductMonthly ? 1 : 0,
      input.active ? 1 : 0,
      input.sortOrder,
      id,
    ]
  );
}

export async function deleteYearlySubscription(
  id: number,
  db?: SQLiteDatabase
): Promise<void> {
  const database = db ?? (await getDatabase());
  await database.runAsync('DELETE FROM yearly_subscriptions WHERE id = ?', [id]);
}