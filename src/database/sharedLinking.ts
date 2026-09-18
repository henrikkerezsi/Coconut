import type { SQLiteDatabase } from 'expo-sqlite';
import { getDatabase } from './database';
import { ensureMonth } from './months';
import { deleteTransaction, upsertSharedTransaction } from './transactions';
import { monthKeyOf } from '../utils/date';

interface LinkedSplitRow {
  expense_uuid: string | null;
  amount_cents: number;
  date: string;
  description: string;
}

export async function reconcileSharedTransactions(
  userId: string,
  db?: SQLiteDatabase
): Promise<number> {
  const database = db ?? (await getDatabase());
  const members = await database.getAllAsync<{ id: number }>(
    `SELECT id FROM shared_space_members WHERE user_id = ? AND status = 'active'`,
    [userId]
  );
  const memberIds = members.map((member) => member.id);

  const activeOriginIds = new Set<string>();
  if (memberIds.length > 0) {
    const placeholders = memberIds.map(() => '?').join(', ');
    const splits = await database.getAllAsync<LinkedSplitRow>(
      `SELECT e.uuid AS expense_uuid, s.amount_cents, e.date, e.description
         FROM shared_expense_splits s
         JOIN shared_expenses e ON e.id = s.expense_id
        WHERE s.member_id IN (${placeholders}) AND e.deleted = 0`,
      memberIds
    );
    for (const split of splits) {
      if (!split.expense_uuid || split.amount_cents <= 0) {
        continue;
      }
      activeOriginIds.add(split.expense_uuid);
      await ensureMonth(monthKeyOf(split.date), database);
      await upsertSharedTransaction(
        split.expense_uuid,
        {
          date: split.date,
          amountCents: split.amount_cents,
          budgetId: null,
          merchant: split.description,
          note: 'Shared expense',
          attachment: null,
        },
        database
      );
    }
  }

  const linked = await database.getAllAsync<{ id: number; origin_id: string | null }>(
    `SELECT id, origin_id FROM transactions WHERE origin_type = 'shared'`
  );
  let removed = 0;
  for (const transaction of linked) {
    if (!transaction.origin_id || !activeOriginIds.has(transaction.origin_id)) {
      await deleteTransaction(transaction.id, database);
      removed += 1;
    }
  }
  return removed;
}
