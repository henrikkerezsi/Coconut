import type { SQLiteDatabase } from 'expo-sqlite';
import type { Month, MonthKey } from '../models';
import { currentMonthKey } from '../utils/date';
import { getDatabase } from './database';
import {
  getActiveFixedExpenses,
  getActualAmountsByExpense,
  getMonthFixedExpenses,
  insertMonthFixedExpense,
  setMonthFixedExpenseExpected,
} from './fixedExpenses';
import {
  getActiveBudgets,
  getMonthBudgets,
  insertMonthBudget,
} from './budgets';
import { getSettings } from './settings';
import { estimateAmount } from '../services/estimation-service';

interface MonthRow {
  month_key: MonthKey;
  allowance_cents: number;
  starting_reserve_cents: number;
  ending_reserve_cents: number | null;
  is_closed: number;
  closed_at: string | null;
}

function rowToMonth(row: MonthRow): Month {
  return {
    monthKey: row.month_key,
    allowanceCents: row.allowance_cents,
    startingReserveCents: row.starting_reserve_cents,
    endingReserveCents: row.ending_reserve_cents,
    isClosed: row.is_closed === 1,
    closedAt: row.closed_at,
  };
}

export async function getMonth(
  monthKey: MonthKey,
  db?: SQLiteDatabase
): Promise<Month | null> {
  const database = db ?? (await getDatabase());
  const row = await database.getFirstAsync<MonthRow>(
    'SELECT * FROM months WHERE month_key = ?',
    [monthKey]
  );
  return row ? rowToMonth(row) : null;
}

export async function getAllMonths(db?: SQLiteDatabase): Promise<Month[]> {
  const database = db ?? (await getDatabase());
  const rows = await database.getAllAsync<MonthRow>(
    'SELECT * FROM months ORDER BY month_key ASC'
  );
  return rows.map(rowToMonth);
}

export async function getLatestMonth(db?: SQLiteDatabase): Promise<Month | null> {
  const database = db ?? (await getDatabase());
  const row = await database.getFirstAsync<MonthRow>(
    'SELECT * FROM months ORDER BY month_key DESC LIMIT 1'
  );
  return row ? rowToMonth(row) : null;
}

export async function getPreviousMonth(
  monthKey: MonthKey,
  db?: SQLiteDatabase
): Promise<Month | null> {
  const database = db ?? (await getDatabase());
  const row = await database.getFirstAsync<MonthRow>(
    'SELECT * FROM months WHERE month_key < ? ORDER BY month_key DESC LIMIT 1',
    [monthKey]
  );
  return row ? rowToMonth(row) : null;
}

export async function getClosedMonths(db?: SQLiteDatabase): Promise<Month[]> {
  const database = db ?? (await getDatabase());
  const rows = await database.getAllAsync<MonthRow>(
    "SELECT * FROM months WHERE is_closed = 1 ORDER BY month_key ASC"
  );
  return rows.map(rowToMonth);
}

export async function insertMonth(
  month: Omit<Month, 'endingReserveCents' | 'isClosed' | 'closedAt'>,
  db?: SQLiteDatabase
): Promise<void> {
  const database = db ?? (await getDatabase());
  await database.runAsync(
    `INSERT OR IGNORE INTO months (month_key, allowance_cents, starting_reserve_cents)
     VALUES (?, ?, ?)`,
    [month.monthKey, month.allowanceCents, month.startingReserveCents]
  );
}

async function computeStartingReserve(
  monthKey: MonthKey,
  db: SQLiteDatabase
): Promise<number> {
  const previous = await getPreviousMonth(monthKey, db);
  if (previous) {
    return previous.endingReserveCents ?? previous.startingReserveCents;
  }
  const settings = await getSettings(db);
  return settings.initialReserveCents;
}

export async function ensureCurrentMonth(db?: SQLiteDatabase): Promise<Month> {
  const database = db ?? (await getDatabase());
  const monthKey = currentMonthKey();
  const existing = await getMonth(monthKey, database);
  if (existing) {
    return existing;
  }

  const settings = await getSettings(database);
  const startingReserve = await computeStartingReserve(monthKey, database);
  await insertMonth(
    {
      monthKey,
      allowanceCents: settings.monthlyAllowanceCents,
      startingReserveCents: startingReserve,
    },
    database
  );
  await materializeMonth(monthKey, database);
  const month = await getMonth(monthKey, database);
  if (!month) {
    throw new Error(`Failed to create month ${monthKey}`);
  }
  return month;
}

export async function materializeMonth(
  monthKey: MonthKey,
  db?: SQLiteDatabase
): Promise<void> {
  const database = db ?? (await getDatabase());
  const fixedExpenses = await getActiveFixedExpenses(database);
  for (const expense of fixedExpenses) {
    const existing = await getMonthFixedExpenses(monthKey, database).then((rows) =>
      rows.find((row) => row.fixedExpenseId === expense.id)
    );
    const estimate = estimateAmount(expense, await getActualAmountsByExpense(expense.id, database));
    if (existing) {
      if (existing.actualAmountCents === null) {
        await setMonthFixedExpenseExpected(existing.id, estimate, database);
      }
    } else {
      await insertMonthFixedExpense(
        {
          monthKey,
          fixedExpenseId: expense.id,
          expectedAmountCents: estimate,
          actualAmountCents: null,
        },
        database
      );
    }
  }

  const budgets = await getActiveBudgets(database);
  for (const budget of budgets) {
    const existing = await getMonthBudgets(monthKey, database).then((rows) =>
      rows.find((row) => row.budgetId === budget.id)
    );
    if (!existing) {
      await insertMonthBudget(
        {
          monthKey,
          budgetId: budget.id,
          plannedAmountCents: budget.defaultAmountCents,
        },
        database
      );
    }
  }
}

export async function updateMonthAllowance(
  monthKey: MonthKey,
  allowanceCents: number,
  db?: SQLiteDatabase
): Promise<void> {
  const database = db ?? (await getDatabase());
  await database.runAsync('UPDATE months SET allowance_cents = ? WHERE month_key = ?', [
    allowanceCents,
    monthKey,
  ]);
}

export async function closeMonth(
  monthKey: MonthKey,
  endingReserveCents: number,
  db?: SQLiteDatabase
): Promise<void> {
  const database = db ?? (await getDatabase());
  await database.runAsync(
    `UPDATE months SET ending_reserve_cents = ?, is_closed = 1, closed_at = datetime('now')
     WHERE month_key = ?`,
    [endingReserveCents, monthKey]
  );
}

export async function reopenMonth(monthKey: MonthKey, db?: SQLiteDatabase): Promise<void> {
  const database = db ?? (await getDatabase());
  await database.runAsync(
    'UPDATE months SET ending_reserve_cents = NULL, is_closed = 0, closed_at = NULL WHERE month_key = ?',
    [monthKey]
  );
}