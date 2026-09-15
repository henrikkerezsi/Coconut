import type { SQLiteDatabase } from 'expo-sqlite';
import type {
  Budget,
  FixedExpense,
  Month,
  MonthBudget,
  MonthFixedExpense,
  MonthKey,
  ReserveTransfer,
  Transaction,
} from '../models';
import { getDatabase } from './database';
import { getMonth, getClosedMonths, getPreviousMonth } from './months';
import { getAllBudgets, getAllMonthBudgets, getMonthBudgets } from './budgets';
import { getMonthFixedExpenses } from './fixedExpenses';
import { getAllTransactions, getMonthTransactions } from './transactions';
import { getMonthTransfers } from './reserve';
import { forecastMonth } from '../services/forecast-service';
import { spendingByCategory } from '../services/statistics-service';

export interface MonthData {
  month: Month;
  fixedExpenses: MonthFixedExpense[];
  budgets: MonthBudget[];
  transactions: Transaction[];
  transfers: ReserveTransfer[];
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
  const [fixedExpenses, budgets, transactions, transfers] = await Promise.all([
    getMonthFixedExpenses(monthKey, database),
    getMonthBudgets(monthKey, database),
    getMonthTransactions(monthKey, database),
    getMonthTransfers(monthKey, database),
  ]);
  return { month, fixedExpenses, budgets, transactions, transfers };
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

export interface CategoryPerformance {
  budgetId: number;
  name: string;
  plannedCents: number;
  spentCents: number;
}

/**
 * Planned vs. spent totals per budget across all closed months.
 */
export async function getCategoryPerformance(
  db?: SQLiteDatabase
): Promise<CategoryPerformance[]> {
  const database = db ?? (await getDatabase());
  const budgetsRow = await getAllBudgets(database);
  const monthBudgets = await getAllMonthBudgets(database);
  const transactions = await getAllTransactions(database);

  const closedMonths = (await getClosedMonths(database)).map((month) => month.monthKey);
  const closedSet = new Set(closedMonths);

  const plannedByBudget = new Map<number, number>();
  for (const monthBudget of monthBudgets) {
    if (!closedSet.has(monthBudget.monthKey)) {
      continue;
    }
    plannedByBudget.set(
      monthBudget.budgetId,
      (plannedByBudget.get(monthBudget.budgetId) ?? 0) + monthBudget.plannedAmountCents
    );
  }
  const spentByBudget = new Map<number, number>();
  for (const transaction of transactions) {
    if (!closedSet.has(transaction.monthKey) || transaction.budgetId === null) {
      continue;
    }
    spentByBudget.set(
      transaction.budgetId,
      (spentByBudget.get(transaction.budgetId) ?? 0) + transaction.amountCents
    );
  }

  const names = new Map(budgetsRow.map((budget) => [budget.id, budget.name]));
  const ids = new Set<number>([...plannedByBudget.keys(), ...spentByBudget.keys()]);
  return [...ids]
    .map((budgetId) => ({
      budgetId,
      name: names.get(budgetId) ?? `Budget #${budgetId}`,
      plannedCents: plannedByBudget.get(budgetId) ?? 0,
      spentCents: spentByBudget.get(budgetId) ?? 0,
    }))
    .sort((a, b) => b.spentCents - a.spentCents);
}

export async function getAllTimeSpendingByCategory(
  db?: SQLiteDatabase
): Promise<Map<number, number>> {
  const database = db ?? (await getDatabase());
  const transactions = await getAllTransactions(database);
  return spendingByCategory(transactions);
}