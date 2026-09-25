import type { SQLiteDatabase } from 'expo-sqlite';
import type { Subscription } from '../models';
import { getDatabase } from './database';

interface SubscriptionRow {
  id: number;
  name: string;
  total_amount_cents: number;
  monthly_amount_cents: number;
  start_month: string;
  end_month: string;
  deduct_monthly: number;
  active: number;
  sort_order: number;
}

function rowToSubscription(row: SubscriptionRow): Subscription {
  return {
    id: row.id,
    name: row.name,
    totalAmountCents: row.total_amount_cents,
    monthlyAmountCents: row.monthly_amount_cents,
    startMonth: row.start_month,
    endMonth: row.end_month,
    deductMonthly: row.deduct_monthly === 1,
    active: row.active === 1,
    sortOrder: row.sort_order,
  };
}

export type SubscriptionInput = Omit<Subscription, 'id'>;

export async function getAllSubscriptions(db?: SQLiteDatabase): Promise<Subscription[]> {
  const database = db ?? (await getDatabase());
  const rows = await database.getAllAsync<SubscriptionRow>(
    'SELECT * FROM yearly_subscriptions ORDER BY sort_order ASC, id ASC'
  );
  return rows.map(rowToSubscription);
}

export async function getSubscription(id: number, db?: SQLiteDatabase): Promise<Subscription | null> {
  const database = db ?? (await getDatabase());
  const row = await database.getFirstAsync<SubscriptionRow>(
    'SELECT * FROM yearly_subscriptions WHERE id = ?',
    [id]
  );
  return row ? rowToSubscription(row) : null;
}

export async function createSubscription(input: SubscriptionInput, db?: SQLiteDatabase): Promise<number> {
  const database = db ?? (await getDatabase());
  const result = await database.runAsync(
    `INSERT INTO yearly_subscriptions
       (name, total_amount_cents, monthly_amount_cents, start_month, end_month, deduct_monthly, active, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      input.name,
      input.totalAmountCents,
      input.monthlyAmountCents,
      input.startMonth,
      input.endMonth,
      input.deductMonthly ? 1 : 0,
      input.active ? 1 : 0,
      input.sortOrder,
    ]
  );
  return result.lastInsertRowId;
}

export async function updateSubscription(id: number, input: SubscriptionInput, db?: SQLiteDatabase): Promise<void> {
  const database = db ?? (await getDatabase());
  await database.runAsync(
    `UPDATE yearly_subscriptions SET
       name = ?, total_amount_cents = ?, monthly_amount_cents = ?,
       start_month = ?, end_month = ?, deduct_monthly = ?, active = ?, sort_order = ?
     WHERE id = ?`,
    [
      input.name,
      input.totalAmountCents,
      input.monthlyAmountCents,
      input.startMonth,
      input.endMonth,
      input.deductMonthly ? 1 : 0,
      input.active ? 1 : 0,
      input.sortOrder,
      id,
    ]
  );
}

export async function reorderSubscriptions(orderedIds: number[], db?: SQLiteDatabase): Promise<void> {
  const database = db ?? (await getDatabase());
  await database.withTransactionAsync(async () => {
    for (let i = 0; i < orderedIds.length; i++) {
      await database.runAsync('UPDATE yearly_subscriptions SET sort_order = ? WHERE id = ?', [
        i,
        orderedIds[i],
      ]);
    }
  });
}

export async function deleteSubscription(id: number, db?: SQLiteDatabase): Promise<void> {
  const database = db ?? (await getDatabase());
  await database.runAsync('DELETE FROM yearly_subscriptions WHERE id = ?', [id]);
}