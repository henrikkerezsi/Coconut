import type { SQLiteDatabase } from 'expo-sqlite';
import { getDatabase } from './database';
import { getAllMonths } from './months';
import { deleteTransaction, upsertSharedTransaction } from './transactions';
import {
  resolveSharedMirrorPlacement,
  type ExistingSharedMirror,
} from '../services/shared-mirror-service';

interface LinkedSplitRow {
  expense_uuid: string | null;
  amount_cents: number;
  date: string;
  description: string;
}

interface LinkedTransactionRow {
  id: number;
  month_key: string;
  date: string;
  origin_id: string | null;
}

export async function decoupleSharedTransactions(
  expenseUuids: string[],
  db?: SQLiteDatabase
): Promise<number> {
  if (expenseUuids.length === 0) {
    return 0;
  }
  const database = db ?? (await getDatabase());
  const placeholders = expenseUuids.map(() => '?').join(', ');
  const result = await database.runAsync(
    `UPDATE transactions
        SET origin_type = NULL, origin_id = NULL
      WHERE origin_type = 'shared' AND origin_id IN (${placeholders})`,
    expenseUuids
  );
  return Number((result as { changes?: number }).changes ?? 0);
}

export interface ReconcileOutcome {
  /** Linked transactions dropped because their shared expense is gone. */
  removed: number;
}

/**
 * The Supabase user this device's dataset belongs to, taken from the local
 * membership rows. Every space on the device is joined by the one signed-in
 * user, and an invite that has not been accepted yet carries no user id, so the
 * distinct value is that user. It is available offline, without asking the auth
 * session for it.
 */
async function localUserId(database: SQLiteDatabase): Promise<string | null> {
  const row = await database.getFirstAsync<{ user_id: string }>(
    `SELECT DISTINCT user_id FROM shared_space_members
      WHERE user_id IS NOT NULL AND status = 'active'
      LIMIT 1`
  );
  return row?.user_id ?? null;
}

/**
 * Brings the personal mirrors of shared expenses in line with the shared rows.
 *
 * A mirror is only ever recorded in a month the user actually has, so this never
 * creates one: a month comes into existence through the user planning it, and a
 * mirror that fabricates one would take over as the active month and leave the
 * user in a period they never planned. An amount with no month to land in is
 * left waiting, and the next reconcile after the month is started picks it up.
 */
async function reconcile(
  userId: string,
  database: SQLiteDatabase
): Promise<ReconcileOutcome> {
  const members = await database.getAllAsync<{ id: number }>(
    `SELECT id FROM shared_space_members WHERE user_id = ? AND status = 'active'`,
    [userId]
  );
  const memberIds = members.map((member) => member.id);

  const months = await getAllMonths(database);
  const linked = await database.getAllAsync<LinkedTransactionRow>(
    `SELECT id, month_key, date, origin_id FROM transactions WHERE origin_type = 'shared'`
  );
  const existingByOrigin = new Map<string, ExistingSharedMirror>();
  for (const transaction of linked) {
    if (transaction.origin_id) {
      existingByOrigin.set(transaction.origin_id, {
        monthKey: transaction.month_key,
        date: transaction.date,
      });
    }
  }

  const liveOriginIds = new Set<string>();
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
      // Liveness is about the shared expense alone, so an amount still waiting
      // for its month is never mistaken for a withdrawn one below and its
      // existing mirror is not thrown away.
      liveOriginIds.add(split.expense_uuid);
      const placement = resolveSharedMirrorPlacement(
        months,
        split.date,
        existingByOrigin.get(split.expense_uuid) ?? null
      );
      if (!placement) {
        continue;
      }
      await upsertSharedTransaction(
        split.expense_uuid,
        {
          date: placement.date,
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

  let removed = 0;
  for (const transaction of linked) {
    if (!transaction.origin_id || !liveOriginIds.has(transaction.origin_id)) {
      await deleteTransaction(transaction.id, database);
      removed += 1;
    }
  }
  return { removed };
}

export async function reconcileSharedTransactions(
  userId: string,
  db?: SQLiteDatabase
): Promise<ReconcileOutcome> {
  const database = db ?? (await getDatabase());
  return reconcile(userId, database);
}

/**
 * Reconciles the mirrors belonging to whoever this device is signed in as. Used
 * where there is no session to hand, such as right after the user starts a month
 * and any amount that was waiting for it can finally be recorded.
 */
export async function reconcileSharedTransactionsForLocalUser(
  db?: SQLiteDatabase
): Promise<ReconcileOutcome> {
  const database = db ?? (await getDatabase());
  const userId = await localUserId(database);
  if (userId === null) {
    return { removed: 0 };
  }
  return reconcile(userId, database);
}
