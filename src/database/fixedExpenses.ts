import type { SQLiteDatabase } from 'expo-sqlite';
import type {
  FixedExpense,
  MonthFixedExpense,
  MonthKey,
} from '../models';
import { getDatabase } from './database';
import { currentMonthKey } from '../utils/date';

interface FixedExpenseRow {
  id: number;
  name: string;
  expected_amount_cents: number;
  kind: string;
  recurrence: string;
  estimation_strategy: string;
  average_months: number | null;
  active: number;
  sort_order: number;
}

function rowToFixedExpense(row: FixedExpenseRow): FixedExpense {
  return {
    id: row.id,
    name: row.name,
    expectedAmountCents: row.expected_amount_cents,
    kind: row.kind === 'variable' ? 'variable' : 'fixed',
    recurrence: row.recurrence === 'monthly' ? 'monthly' : 'monthly',
    estimationStrategy: row.estimation_strategy as FixedExpense['estimationStrategy'],
    averageMonths: row.average_months,
    active: row.active === 1,
    sortOrder: row.sort_order,
  };
}

export async function getAllFixedExpenses(
  db?: SQLiteDatabase
): Promise<FixedExpense[]> {
  const database = db ?? (await getDatabase());
  const rows = await database.getAllAsync<FixedExpenseRow>(
    'SELECT * FROM fixed_expenses ORDER BY sort_order ASC, id ASC'
  );
  return rows.map(rowToFixedExpense);
}

export async function getActiveFixedExpenses(
  db?: SQLiteDatabase
): Promise<FixedExpense[]> {
  const database = db ?? (await getDatabase());
  const rows = await database.getAllAsync<FixedExpenseRow>(
    'SELECT * FROM fixed_expenses WHERE active = 1 ORDER BY sort_order ASC, id ASC'
  );
  return rows.map(rowToFixedExpense);
}

export async function getFixedExpense(
  id: number,
  db?: SQLiteDatabase
): Promise<FixedExpense | null> {
  const database = db ?? (await getDatabase());
  const row = await database.getFirstAsync<FixedExpenseRow>(
    'SELECT * FROM fixed_expenses WHERE id = ?',
    [id]
  );
  return row ? rowToFixedExpense(row) : null;
}

export async function createFixedExpense(
  input: Omit<FixedExpense, 'id'>,
  db?: SQLiteDatabase
): Promise<number> {
  const database = db ?? (await getDatabase());
  const result = await database.runAsync(
    `INSERT INTO fixed_expenses
       (name, expected_amount_cents, kind, recurrence, estimation_strategy, average_months, active, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      input.name,
      input.expectedAmountCents,
      input.kind,
      input.recurrence,
      input.estimationStrategy,
      input.averageMonths,
      input.active ? 1 : 0,
      input.sortOrder,
    ]
  );
  return result.lastInsertRowId;
}

export async function updateFixedExpense(
  id: number,
  input: Omit<FixedExpense, 'id'>,
  db?: SQLiteDatabase
): Promise<void> {
  const database = db ?? (await getDatabase());
  await database.runAsync(
    `UPDATE fixed_expenses SET
       name = ?, expected_amount_cents = ?, kind = ?, recurrence = ?,
       estimation_strategy = ?, average_months = ?, active = ?, sort_order = ?
     WHERE id = ?`,
    [
      input.name,
      input.expectedAmountCents,
      input.kind,
      input.recurrence,
      input.estimationStrategy,
      input.averageMonths,
      input.active ? 1 : 0,
      input.sortOrder,
      id,
    ]
  );
}

export async function deleteFixedExpense(id: number, db?: SQLiteDatabase): Promise<void> {
  const database = db ?? (await getDatabase());
  await database.withTransactionAsync(async () => {
    // Remove only the current month's instance together with the definition.
    // Past months keep their recorded instances.
    await database.runAsync(
      'DELETE FROM month_fixed_expenses WHERE fixed_expense_id = ? AND month_key = ?',
      [id, currentMonthKey()]
    );
    await database.runAsync('DELETE FROM fixed_expenses WHERE id = ?', [id]);
  });
}

interface MonthFixedExpenseRow {
  id: number;
  month_key: MonthKey;
  fixed_expense_id: number;
  expected_amount_cents: number;
  actual_amount_cents: number | null;
}

function rowToMonthFixedExpense(row: MonthFixedExpenseRow): MonthFixedExpense {
  return {
    id: row.id,
    monthKey: row.month_key,
    fixedExpenseId: row.fixed_expense_id,
    expectedAmountCents: row.expected_amount_cents,
    actualAmountCents: row.actual_amount_cents,
  };
}

export async function insertMonthFixedExpense(
  input: Omit<MonthFixedExpense, 'id'>,
  db?: SQLiteDatabase
): Promise<void> {
  const database = db ?? (await getDatabase());
  await database.runAsync(
    `INSERT INTO month_fixed_expenses
       (month_key, fixed_expense_id, expected_amount_cents, actual_amount_cents)
     VALUES (?, ?, ?, ?)`,
    [input.monthKey, input.fixedExpenseId, input.expectedAmountCents, input.actualAmountCents]
  );
}

export async function getMonthFixedExpenses(
  monthKey: MonthKey,
  db?: SQLiteDatabase
): Promise<MonthFixedExpense[]> {
  const database = db ?? (await getDatabase());
  const rows = await database.getAllAsync<MonthFixedExpenseRow>(
    'SELECT * FROM month_fixed_expenses WHERE month_key = ? ORDER BY id ASC',
    [monthKey]
  );
  return rows.map(rowToMonthFixedExpense);
}

export async function getAllMonthFixedExpenses(
  db?: SQLiteDatabase
): Promise<MonthFixedExpense[]> {
  const database = db ?? (await getDatabase());
  const rows = await database.getAllAsync<MonthFixedExpenseRow>(
    'SELECT * FROM month_fixed_expenses ORDER BY month_key ASC, id ASC'
  );
  return rows.map(rowToMonthFixedExpense);
}

export async function getMonthFixedExpense(
  id: number,
  db?: SQLiteDatabase
): Promise<MonthFixedExpense | null> {
  const database = db ?? (await getDatabase());
  const row = await database.getFirstAsync<MonthFixedExpenseRow>(
    'SELECT * FROM month_fixed_expenses WHERE id = ?',
    [id]
  );
  return row ? rowToMonthFixedExpense(row) : null;
}

export async function setMonthFixedExpenseActual(
  id: number,
  actualAmountCents: number | null,
  db?: SQLiteDatabase
): Promise<void> {
  const database = db ?? (await getDatabase());
  await database.runAsync(
    'UPDATE month_fixed_expenses SET actual_amount_cents = ? WHERE id = ?',
    [actualAmountCents, id]
  );
}

export async function setMonthFixedExpenseExpected(
  id: number,
  expectedAmountCents: number,
  db?: SQLiteDatabase
): Promise<void> {
  const database = db ?? (await getDatabase());
  await database.runAsync(
    'UPDATE month_fixed_expenses SET expected_amount_cents = ? WHERE id = ?',
    [expectedAmountCents, id]
  );
}

export async function deleteMonthFixedExpense(
  id: number,
  db?: SQLiteDatabase
): Promise<void> {
  const database = db ?? (await getDatabase());
  await database.runAsync('DELETE FROM month_fixed_expenses WHERE id = ?', [id]);
}

export async function getActualAmountsByExpense(
  fixedExpenseId: number,
  db?: SQLiteDatabase
): Promise<{ monthKey: MonthKey; actualAmountCents: number }[]> {
  const database = db ?? (await getDatabase());
  const rows = await database.getAllAsync<{
    month_key: MonthKey;
    actual_amount_cents: number;
  }>(
    `SELECT month_key, actual_amount_cents FROM month_fixed_expenses
     WHERE fixed_expense_id = ? AND actual_amount_cents IS NOT NULL
     ORDER BY month_key ASC`,
    [fixedExpenseId]
  );
  return rows.map((row) => ({
    monthKey: row.month_key,
    actualAmountCents: row.actual_amount_cents,
  }));
}