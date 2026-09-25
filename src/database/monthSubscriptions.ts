import type { SQLiteDatabase } from 'expo-sqlite';
import type { MonthKey, MonthSubscription } from '../models';
import { getDatabase } from './database';

interface MonthSubscriptionRow {
  id: number;
  month_key: string;
  subscription_id: number | null;
  name: string;
  amount_cents: number;
}

function rowToMonthSubscription(row: MonthSubscriptionRow): MonthSubscription {
  return {
    id: row.id,
    monthKey: row.month_key,
    subscriptionId: row.subscription_id,
    name: row.name,
    amountCents: row.amount_cents,
  };
}

export async function getMonthSubscriptions(
  monthKey: MonthKey,
  db?: SQLiteDatabase
): Promise<MonthSubscription[]> {
  const database = db ?? (await getDatabase());
  const rows = await database.getAllAsync<MonthSubscriptionRow>(
    `SELECT * FROM month_subscriptions WHERE month_key = ? ORDER BY subscription_id ASC, id ASC`,
    [monthKey]
  );
  return rows.map(rowToMonthSubscription);
}

export async function replaceMonthSubscriptions(
  monthKey: MonthKey,
  charges: { subscriptionId: number | null; name: string; amountCents: number }[],
  db?: SQLiteDatabase
): Promise<void> {
  const database = db ?? (await getDatabase());
  await database.runAsync('DELETE FROM month_subscriptions WHERE month_key = ?', [monthKey]);
  for (const charge of charges) {
    await database.runAsync(
      'INSERT INTO month_subscriptions (month_key, subscription_id, name, amount_cents) VALUES (?, ?, ?, ?)',
      [monthKey, charge.subscriptionId, charge.name, charge.amountCents]
    );
  }
}
