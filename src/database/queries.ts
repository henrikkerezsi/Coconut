import type { SQLiteDatabase } from 'expo-sqlite';
import type {
  Budget,
  FixedExpense,
  Income,
  Month,
  MonthBudget,
  MonthFixedExpense,
  MonthKey,
  MonthSubscription,
  Transaction,
} from '../models';
import { getDatabase } from './database';
import { getMonth, getClosedMonths, getPreviousMonth } from './months';
import { getAllBudgets, getAllMonthBudgets, getActiveBudgets, getMonthBudgets } from './budgets';
import {
  getActiveFixedExpenses,
  getActualAmountsByExpense,
  getMonthFixedExpenses,
} from './fixedExpenses';
import { getAllTransactions, getMonthTransactions } from './transactions';
import { getMonthIncome } from './income';
import { getMonthSubscriptions } from './monthSubscriptions';
import { getAllSubscriptions } from './subscriptions';
import { getSettings } from './settings';
import { getPlannedDrawCents } from './monthPlan';
import { forecastMonth } from '../services/forecast-service';
import {
  averageBudgetPerformance,
  ratingSharesForMonth,
  type BudgetMonthPerformance,
} from '../services/statistics-service';
import { estimateAmount } from '../services/estimation-service';
import { subscriptionChargesForMonth } from '../services/subscription-service';

export interface MonthData {
  month: Month;
  fixedExpenses: MonthFixedExpense[];
  budgets: MonthBudget[];
  transactions: Transaction[];
  income: Income[];
  subscriptions: MonthSubscription[];
}

export interface MonthDataWithDefinitions extends MonthData {
  fixedExpenseDefinitions: Record<number, FixedExpense>;
  budgetDefinitions: Record<number, Budget>;
}

export async function getMonthData(
  monthKey: MonthKey,
  db?: SQLiteDatabase
): Promise<MonthData | null> {
  const database = db ?? (await getDatabase());
  const month = await getMonth(monthKey, database);
  if (!month) {
    return null;
  }
  const [fixedExpenses, budgets, transactions, income, subscriptions] = await Promise.all([
    getMonthFixedExpenses(monthKey, database),
    getMonthBudgets(monthKey, database),
    getMonthTransactions(monthKey, database),
    getMonthIncome(monthKey, database),
    getMonthSubscriptions(monthKey, database),
  ]);
  return { month, fixedExpenses, budgets, transactions, income, subscriptions };
}

export async function getPreviousMonthData(
  monthKey: MonthKey,
  db?: SQLiteDatabase
): Promise<MonthData | null> {
  const database = db ?? (await getDatabase());
  const previous = await getPreviousMonth(monthKey, database);
  if (!previous) {
    return null;
  }
  return getMonthData(previous.monthKey, database);
}

export async function getMonthTotalsByExpense(
  monthKey: MonthKey,
  db?: SQLiteDatabase
): Promise<Map<number, number>> {
  const database = db ?? (await getDatabase());
  const rows = await database.getAllAsync<{ budget_id: number; total: number }>(
    `SELECT budget_id, SUM(amount_cents) AS total FROM transactions
     WHERE month_key = ? AND budget_id IS NOT NULL GROUP BY budget_id`,
    [monthKey]
  );
  return new Map(rows.map((row) => [row.budget_id, row.total]));
}

export interface ClosedMonthRecord {
  monthKey: MonthKey;
  allowanceCents: number;
  spendingCents: number;
  reserveAdjustmentCents: number;
  endingReserveCents: number | null;
}

/**
 * Builds one record per closed month with its actual spending and the resulting
 * reserve adjustment. Deterministic: every value is derived from stored data.
 */
export async function getClosedMonthRecords(
  db?: SQLiteDatabase
): Promise<ClosedMonthRecord[]> {
  const database = db ?? (await getDatabase());
  const months = await getClosedMonths(database);
  const records: ClosedMonthRecord[] = [];
  for (const month of months) {
    const data = await getMonthData(month.monthKey, database);
    if (!data) {
      continue;
    }
    const forecast = forecastMonth({
      month,
      fixedExpenses: data.fixedExpenses,
      budgets: data.budgets,
      transactions: data.transactions,
      income: data.income,
      subscriptions: data.subscriptions,
    });
    records.push({
      monthKey: month.monthKey,
      allowanceCents: month.allowanceCents,
      spendingCents: forecast.actualSpendingCents,
      reserveAdjustmentCents: forecast.expectedAdjustmentCents,
      endingReserveCents: month.endingReserveCents,
    });
  }
  return records;
}

export interface MonthPlanningInputs {
  monthKey: MonthKey;
  allowanceCents: number;
  /** The reserve the month starts on, carried forward, which a draw never changes. */
  startingReserveCents: number;
  /** Expected amounts for a month that does not exist yet. */
  fixedExpenses: MonthFixedExpense[];
  subscriptions: MonthSubscription[];
  /** Every active budget, pre-filled with its default amount. */
  budgets: MonthBudget[];
  /**
   * The planned amounts the month already stands at, when it exists. Empty for
   * a month that has yet to be started, which is what tells the planning screen
   * whether it is starting a month or re-planning one.
   */
  currentPlans: Record<number, number>;
  /** The reserve draw the month already plans with, from the plan record. */
  currentDrawCents: number;
}

/**
 * Everything the planning screen needs to plan a month: the allowance and
 * starting reserve it has or would be created with, the fixed expenses and
 * subscriptions it carries or is expected to carry, and the budgets it can be
 * planned across. Nothing is written.
 *
 * A month that does not exist yet is described from the current settings and
 * estimates, because that is what it would be created with. A month that does
 * exist is described from itself: its own allowance and starting reserve, the
 * fixed expenses and subscription charges it was materialized with, and the
 * plan it stands at. Re-planning a month must never quietly re-estimate it.
 */
export async function getMonthPlanningInputs(
  monthKey: MonthKey,
  db?: SQLiteDatabase
): Promise<MonthPlanningInputs> {
  const database = db ?? (await getDatabase());
  const [month, settings, previous, fixedExpenseDefinitions, budgetDefinitions, subscriptions] =
    await Promise.all([
      getMonth(monthKey, database),
      getSettings(database),
      getPreviousMonth(monthKey, database),
      getActiveFixedExpenses(database),
      getActiveBudgets(database),
      getAllSubscriptions(database),
    ]);

  const fixedExpenses: MonthFixedExpense[] = [];
  if (month) {
    for (const snapshot of await getMonthFixedExpenses(monthKey, database)) {
      fixedExpenses.push({
        ...snapshot,
        expectedAmountCents: snapshot.expectedAmountCents,
      });
    }
  } else {
    for (const expense of fixedExpenseDefinitions) {
      const actuals = await getActualAmountsByExpense(expense.id, database);
      fixedExpenses.push({
        id: 0,
        monthKey,
        fixedExpenseId: expense.id,
        expectedAmountCents: estimateAmount(expense, actuals, monthKey),
        actualAmountCents: null,
      });
    }
  }

  const monthSubscriptionCharges = month
    ? (await getMonthSubscriptions(monthKey, database)).map((charge) => ({
        subscriptionId: charge.subscriptionId,
        name: charge.name,
        amountCents: charge.amountCents,
      }))
    : subscriptionChargesForMonth(subscriptions, monthKey);

  const currentPlans: Record<number, number> = {};
  for (const row of await getMonthBudgets(monthKey, database)) {
    currentPlans[row.budgetId] = row.plannedAmountCents;
  }

  return {
    monthKey,
    allowanceCents: month ? month.allowanceCents : settings.monthlyAllowanceCents,
    startingReserveCents: month
      ? month.startingReserveCents
      : previous
        ? previous.endingReserveCents ?? previous.startingReserveCents
        : settings.initialReserveCents,
    fixedExpenses,
    subscriptions: monthSubscriptionCharges.map((charge, index) => ({
      id: index,
      monthKey,
      subscriptionId: charge.subscriptionId,
      name: charge.name,
      amountCents: charge.amountCents,
    })),
    budgets: budgetDefinitions.map((budget, index) => ({
      id: index,
      monthKey,
      budgetId: budget.id,
      plannedAmountCents: budget.defaultAmountCents,
    })),
    currentPlans,
    currentDrawCents: await getPlannedDrawCents(monthKey, database),
  };
}

export interface RatingPerformancePoint {
  monthKey: MonthKey;
  regret: number;
  neutral: number;
  good: number;
}

/**
 * Per closed month, the share of its transactions rated regret, neutral and
 * good. Unrated purchases count as neutral. Months without transactions are
 * omitted.
 */
export async function getRatingPerformance(
  db?: SQLiteDatabase
): Promise<RatingPerformancePoint[]> {
  const database = db ?? (await getDatabase());
  const closedMonths = await getClosedMonths(database);
  const closedSet = new Set(closedMonths.map((month) => month.monthKey));
  const transactionsByMonth = new Map<MonthKey, Transaction[]>();
  for (const transaction of await getAllTransactions(database)) {
    if (!closedSet.has(transaction.monthKey)) {
      continue;
    }
    const list = transactionsByMonth.get(transaction.monthKey) ?? [];
    list.push(transaction);
    transactionsByMonth.set(transaction.monthKey, list);
  }
  const points: RatingPerformancePoint[] = [];
  for (const month of closedMonths) {
    const shares = ratingSharesForMonth(transactionsByMonth.get(month.monthKey) ?? []);
    if (shares) {
      points.push({ monthKey: month.monthKey, ...shares });
    }
  }
  return points;
}

export interface BudgetPerformanceRecord {
  budgetId: number;
  name: string;
  /** Average of each closed month's spent-to-planned ratio, as a percentage. */
  averagePercent: number | null;
}

/**
 * Per-budget performance across closed months: the percentage of its monthly
 * plan that was spent, averaged over every month the budget was allocated. The
 * averaging is deliberately per month rather than over the summed totals, so a
 * month where spending ran 110% and another where it ran 90% average to 100%.
 */
export async function getBudgetPerformance(
  db?: SQLiteDatabase
): Promise<BudgetPerformanceRecord[]> {
  const database = db ?? (await getDatabase());
  const budgetRows = await getAllBudgets(database);
  const monthBudgets = await getAllMonthBudgets(database);
  const transactions = await getAllTransactions(database);

  const closedMonths = (await getClosedMonths(database)).map((month) => month.monthKey);
  const closedSet = new Set(closedMonths);

  const spentByBudgetByMonth = new Map<number, Map<MonthKey, number>>();
  for (const transaction of transactions) {
    if (!closedSet.has(transaction.monthKey) || transaction.budgetId === null) {
      continue;
    }
    let byMonth = spentByBudgetByMonth.get(transaction.budgetId);
    if (!byMonth) {
      byMonth = new Map();
      spentByBudgetByMonth.set(transaction.budgetId, byMonth);
    }
    byMonth.set(
      transaction.monthKey,
      (byMonth.get(transaction.monthKey) ?? 0) + transaction.amountCents
    );
  }

  const monthsByBudget = new Map<number, BudgetMonthPerformance[]>();
  for (const monthBudget of monthBudgets) {
    if (!closedSet.has(monthBudget.monthKey)) {
      continue;
    }
    const spent = spentByBudgetByMonth.get(monthBudget.budgetId)?.get(monthBudget.monthKey) ?? 0;
    const list = monthsByBudget.get(monthBudget.budgetId) ?? [];
    list.push({ plannedCents: monthBudget.plannedAmountCents, spentCents: spent });
    monthsByBudget.set(monthBudget.budgetId, list);
  }

  const names = new Map(budgetRows.map((budget) => [budget.id, budget.name]));
  return [...monthsByBudget.entries()]
    .map(([budgetId, months]) => ({
      budgetId,
      name: names.get(budgetId) ?? `Budget #${budgetId}`,
      averagePercent: averageBudgetPerformance(months),
    }))
    .sort(
      (a, b) =>
        (b.averagePercent ?? -1) - (a.averagePercent ?? -1) || a.budgetId - b.budgetId
    );
}