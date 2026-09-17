import type { SQLiteDatabase } from 'expo-sqlite';
import type { Budget, MonthBudget, MonthKey } from '../models';
import { getDatabase } from './database';

interface BudgetRow {
  id: number;
  name: string;
  default_amount_cents: number;
  active: number;
  sort_order: number;
  color: string | null;
}

function rowToBudget(row: BudgetRow): Budget {
  return {
    id: row.id,
    name: row.name,
    defaultAmountCents: row.default_amount_cents,
    active: row.active === 1,
    sortOrder: row.sort_order,
    color: row.color,
  };
}

export async function getAllBudgets(db?: SQLiteDatabase): Promise<Budget[]> {
  const database = db ?? (await getDatabase());
  const rows = await database.getAllAsync<BudgetRow>(
    'SELECT * FROM budgets ORDER BY sort_order ASC, id ASC'
  );
  return rows.map(rowToBudget);
}

export async function getActiveBudgets(db?: SQLiteDatabase): Promise<Budget[]> {
  const database = db ?? (await getDatabase());
  const rows = await database.getAllAsync<BudgetRow>(
    'SELECT * FROM budgets WHERE active = 1 ORDER BY sort_order ASC, id ASC'
  );
  return rows.map(rowToBudget);
}

export async function getBudget(id: number, db?: SQLiteDatabase): Promise<Budget | null> {
  const database = db ?? (await getDatabase());
  const row = await database.getFirstAsync<BudgetRow>('SELECT * FROM budgets WHERE id = ?', [id]);
  return row ? rowToBudget(row) : null;
}

export async function createBudget(
  input: Omit<Budget, 'id'>,
  db?: SQLiteDatabase
): Promise<number> {
  const database = db ?? (await getDatabase());
  const result = await database.runAsync(
    `INSERT INTO budgets (name, default_amount_cents, active, sort_order, color)
     VALUES (?, ?, ?, ?, ?)`,
    [input.name, input.defaultAmountCents, input.active ? 1 : 0, input.sortOrder, input.color]
  );
  return result.lastInsertRowId;
}

export async function updateBudget(
  id: number,
  input: Omit<Budget, 'id'>,
  db?: SQLiteDatabase
): Promise<void> {
  const database = db ?? (await getDatabase());
  await database.runAsync(
    'UPDATE budgets SET name = ?, default_amount_cents = ?, active = ?, sort_order = ?, color = ? WHERE id = ?',
    [input.name, input.defaultAmountCents, input.active ? 1 : 0, input.sortOrder, input.color, id]
  );
}

export async function deleteBudget(id: number, db?: SQLiteDatabase): Promise<void> {
  const database = db ?? (await getDatabase());
  await database.runAsync('DELETE FROM budgets WHERE id = ?', [id]);
}

interface MonthBudgetRow {
  id: number;
  month_key: MonthKey;
  budget_id: number;
  planned_amount_cents: number;
}

function rowToMonthBudget(row: MonthBudgetRow): MonthBudget {
  return {
    id: row.id,
    monthKey: row.month_key,
    budgetId: row.budget_id,
    plannedAmountCents: row.planned_amount_cents,
  };
}

export async function insertMonthBudget(
  input: Omit<MonthBudget, 'id'>,
  db?: SQLiteDatabase
): Promise<void> {
  const database = db ?? (await getDatabase());
  await database.runAsync(
    'INSERT INTO month_budgets (month_key, budget_id, planned_amount_cents) VALUES (?, ?, ?)',
    [input.monthKey, input.budgetId, input.plannedAmountCents]
  );
}

export async function getMonthBudgets(
  monthKey: MonthKey,
  db?: SQLiteDatabase
): Promise<MonthBudget[]> {
  const database = db ?? (await getDatabase());
  const rows = await database.getAllAsync<MonthBudgetRow>(
    'SELECT * FROM month_budgets WHERE month_key = ? ORDER BY id ASC',
    [monthKey]
  );
  return rows.map(rowToMonthBudget);
}

export async function getAllMonthBudgets(db?: SQLiteDatabase): Promise<MonthBudget[]> {
  const database = db ?? (await getDatabase());
  const rows = await database.getAllAsync<MonthBudgetRow>(
    'SELECT * FROM month_budgets ORDER BY month_key ASC, id ASC'
  );
  return rows.map(rowToMonthBudget);
}

export async function setMonthBudgetPlanned(
  id: number,
  plannedAmountCents: number,
  db?: SQLiteDatabase
): Promise<void> {
  const database = db ?? (await getDatabase());
  await database.runAsync('UPDATE month_budgets SET planned_amount_cents = ? WHERE id = ?', [
    plannedAmountCents,
    id,
  ]);
}