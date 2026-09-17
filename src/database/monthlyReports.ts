import type { SQLiteDatabase } from 'expo-sqlite';
import type { MonthKey } from '../models';
import { getDatabase } from './database';
import { getMonthData } from './queries';
import { getAllBudgets } from './budgets';
import { getAllFixedExpenses } from './fixedExpenses';
import { buildMonthlyReport, type MonthlyReport } from '../services/monthly-report-service';

/**
 * Builds the end-of-month report for a closed month from its stored data.
 * Returns null for unknown months and for months that are not closed yet.
 */
export async function getMonthlyReport(
  monthKey: MonthKey,
  db?: SQLiteDatabase
): Promise<MonthlyReport | null> {
  const database = db ?? (await getDatabase());
  const data = await getMonthData(monthKey, database);
  if (!data || !data.month.isClosed) {
    return null;
  }
  const [budgetRows, fixedExpenseRows] = await Promise.all([
    getAllBudgets(database),
    getAllFixedExpenses(database),
  ]);
  const budgetDefinitions = Object.fromEntries(budgetRows.map((budget) => [budget.id, budget]));
  const fixedExpenseDefinitions = Object.fromEntries(
    fixedExpenseRows.map((expense) => [expense.id, expense])
  );
  return buildMonthlyReport({ ...data, budgetDefinitions, fixedExpenseDefinitions });
}