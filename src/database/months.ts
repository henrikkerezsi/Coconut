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
  setMonthBudgetPlanned,
} from './budgets';
import { getSettings } from './settings';
import { getAllSubscriptions } from './subscriptions';
import { replaceMonthSubscriptions } from './monthSubscriptions';
import { writeMonthPlanStart } from './monthPlan';
import { estimateAmount } from '../services/estimation-service';
import { subscriptionChargesForMonth } from '../services/subscription-service';

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

export async function computeStartingReserve(
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

  // Subscription charges are frozen per month, so later edits, deactivations or
  // deletions never rewrite what a month already charged.
  await materializeMonthSubscriptions(monthKey, database);
}

export interface PlannedMonthInput {
  monthKey: MonthKey;
  /** Planned amount per budget; a budget left out keeps its default amount. */
  budgetPlans: Record<number, number>;
  /**
   * The reserve draw the user planned this month with. Recorded as the month's
   * opening draw so that raising it later is a change against a known start; it
   * moves no money and is not stored on the month itself.
   */
  drawCents: number;
}

/**
 * Creates the month the app is about to work on, together with the plan the user
 * laid out for it. This is the only way a month comes into existence: the app
 * never creates one on its own, so the user always decides when a period starts
 * and what it is planned to spend.
 *
 * The month, its fixed expenses, its subscription charges and its budget plan
 * are written in one transaction, so a month never exists half-planned.
 */
export async function createPlannedMonth(
  input: PlannedMonthInput,
  db?: SQLiteDatabase
): Promise<Month> {
  const database = db ?? (await getDatabase());
  await database.withTransactionAsync(async () => {
    const settings = await getSettings(database);
    const startingReserveCents = await computeStartingReserve(input.monthKey, database);
    await insertMonth(
      {
        monthKey: input.monthKey,
        allowanceCents: settings.monthlyAllowanceCents,
        startingReserveCents,
      },
      database
    );
    await materializeMonth(input.monthKey, database);
    for (const monthBudget of await getMonthBudgets(input.monthKey, database)) {
      const plannedAmountCents = input.budgetPlans[monthBudget.budgetId];
      if (plannedAmountCents !== undefined && plannedAmountCents !== monthBudget.plannedAmountCents) {
        await setMonthBudgetPlanned(monthBudget.id, plannedAmountCents, database);
      }
    }
    await writeMonthPlanStart(
      input.monthKey,
      (await getMonthBudgets(input.monthKey, database)).map((row) => ({
        budgetId: row.budgetId,
        plannedAmountCents: row.plannedAmountCents,
      })),
      input.drawCents,
      database
    );
  });
  const month = await getMonth(input.monthKey, database);
  if (!month) {
    throw new Error(`Failed to create month ${input.monthKey}`);
  }
  return month;
}

export async function materializeMonthSubscriptions(
  monthKey: MonthKey,
  db?: SQLiteDatabase
): Promise<void> {
  const database = db ?? (await getDatabase());
  const subscriptions = await getAllSubscriptions(database);
  await replaceMonthSubscriptions(
    monthKey,
    subscriptionChargesForMonth(subscriptions, monthKey),
    database
  );
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

export async function updateMonthStartingReserve(
  monthKey: MonthKey,
  startingReserveCents: number,
  db?: SQLiteDatabase
): Promise<void> {
  const database = db ?? (await getDatabase());
  await database.runAsync('UPDATE months SET starting_reserve_cents = ? WHERE month_key = ?', [
    startingReserveCents,
    monthKey,
  ]);
}

/**
 * Closes a month permanently, storing the reserve balance it ended on. Returns
 * false when the month was already closed, so the caller can avoid recording
 * the closing adjustment twice.
 */
export async function closeMonth(
  monthKey: MonthKey,
  endingReserveCents: number,
  db?: SQLiteDatabase
): Promise<boolean> {
  const database = db ?? (await getDatabase());
  const result = await database.runAsync(
    `UPDATE months SET ending_reserve_cents = ?, is_closed = 1, closed_at = datetime('now')
     WHERE month_key = ? AND is_closed = 0`,
    [endingReserveCents, monthKey]
  );
  return result.changes > 0;
}