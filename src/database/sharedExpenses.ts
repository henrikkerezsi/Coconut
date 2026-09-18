import type { SQLiteDatabase } from 'expo-sqlite';
import type {
  SharedExpense,
  SharedExpenseSplit,
  SharedExpenseWithSplits,
  SharedPeriodReport,
  SharedPeriodReportData,
  SharedSplitRecord,
} from '../models';
import { getDatabase } from './database';

interface SharedExpenseRow {
  id: number;
  uuid: string | null;
  space_id: number;
  period_id: number;
  description: string;
  total_amount_cents: number;
  date: string;
  paid_by_member_id: number;
  note: string | null;
  created_by_user_id: string | null;
  created_at: string;
  updated_at: string | null;
  deleted: number;
}

interface SharedSplitRow {
  id: number;
  uuid: string | null;
  expense_id: number;
  member_id: number;
  amount_cents: number;
  updated_at: string | null;
}

interface SharedReportRow {
  id: number;
  uuid: string | null;
  space_id: number;
  period_id: number;
  report_json: string;
  closed_at: string;
  closed_by_member_id: number | null;
  updated_at: string | null;
}

export interface SharedExpenseInput {
  spaceId: number;
  periodId: number;
  description: string;
  totalAmountCents: number;
  date: string;
  paidByMemberId: number;
  note: string | null;
  createdByUserId: string | null;
}

export interface SharedExpenseTrace {
  expenseId: number;
  spaceId: number;
  spaceName: string;
  paidByName: string;
  totalAmountCents: number;
}

function rowToExpense(row: SharedExpenseRow): SharedExpense {
  return {
    id: row.id,
    uuid: row.uuid,
    spaceId: row.space_id,
    periodId: row.period_id,
    description: row.description,
    totalAmountCents: row.total_amount_cents,
    date: row.date,
    paidByMemberId: row.paid_by_member_id,
    note: row.note,
    createdByUserId: row.created_by_user_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deleted: row.deleted === 1,
  };
}

function rowToSplit(row: SharedSplitRow): SharedExpenseSplit {
  return {
    id: row.id,
    uuid: row.uuid,
    expenseId: row.expense_id,
    memberId: row.member_id,
    amountCents: row.amount_cents,
    updatedAt: row.updated_at,
  };
}

export async function listPeriodExpenses(
  periodId: number,
  db?: SQLiteDatabase
): Promise<SharedExpenseWithSplits[]> {
  const database = db ?? (await getDatabase());
  const expenseRows = await database.getAllAsync<SharedExpenseRow>(
    `SELECT * FROM shared_expenses
      WHERE period_id = ? AND deleted = 0
      ORDER BY date ASC, id ASC`,
    [periodId]
  );
  if (expenseRows.length === 0) {
    return [];
  }
  const splitRows = await database.getAllAsync<SharedSplitRow>(
    `SELECT s.* FROM shared_expense_splits s
       JOIN shared_expenses e ON e.id = s.expense_id
      WHERE e.period_id = ? AND e.deleted = 0
      ORDER BY s.id ASC`,
    [periodId]
  );
  const splitsByExpense = new Map<number, SharedExpenseSplit[]>();
  for (const row of splitRows) {
    const list = splitsByExpense.get(row.expense_id) ?? [];
    list.push(rowToSplit(row));
    splitsByExpense.set(row.expense_id, list);
  }
  return expenseRows.map((row) => ({
    expense: rowToExpense(row),
    splits: splitsByExpense.get(row.id) ?? [],
  }));
}

export async function getExpenseWithSplits(
  id: number,
  db?: SQLiteDatabase
): Promise<SharedExpenseWithSplits | null> {
  const database = db ?? (await getDatabase());
  const row = await database.getFirstAsync<SharedExpenseRow>(
    'SELECT * FROM shared_expenses WHERE id = ?',
    [id]
  );
  if (!row) {
    return null;
  }
  const splitRows = await database.getAllAsync<SharedSplitRow>(
    'SELECT * FROM shared_expense_splits WHERE expense_id = ? ORDER BY id ASC',
    [id]
  );
  return { expense: rowToExpense(row), splits: splitRows.map(rowToSplit) };
}

interface TraceRow {
  id: number;
  space_id: number;
  space_name: string;
  payer_display_name: string | null;
  payer_email: string | null;
  total_amount_cents: number;
}

function rowToTrace(row: TraceRow): SharedExpenseTrace {
  return {
    expenseId: row.id,
    spaceId: row.space_id,
    spaceName: row.space_name,
    paidByName: row.payer_display_name ?? row.payer_email ?? 'Someone',
    totalAmountCents: row.total_amount_cents,
  };
}

export async function getExpenseTracesByOriginIds(
  originIds: string[],
  db?: SQLiteDatabase
): Promise<SharedExpenseTrace[]> {
  if (originIds.length === 0) {
    return [];
  }
  const database = db ?? (await getDatabase());
  const placeholders = originIds.map(() => '?').join(', ');
  const rows = await database.getAllAsync<TraceRow>(
    `SELECT e.id, e.space_id, s.name AS space_name,
            m.display_name AS payer_display_name, m.email AS payer_email,
            e.total_amount_cents
       FROM shared_expenses e
       JOIN shared_spaces s ON s.id = e.space_id
       LEFT JOIN shared_space_members m ON m.id = e.paid_by_member_id
      WHERE e.uuid IN (${placeholders}) AND e.deleted = 0
      ORDER BY e.id ASC`,
    originIds
  );
  return rows.map(rowToTrace);
}

export async function getExpenseTraceByOriginId(
  originId: string,
  db?: SQLiteDatabase
): Promise<SharedExpenseTrace | null> {
  const traces = await getExpenseTracesByOriginIds([originId], db);
  return traces[0] ?? null;
}

async function replaceSplits(
  database: SQLiteDatabase,
  expenseId: number,
  splits: SharedSplitRecord[]
): Promise<void> {
  await database.runAsync('DELETE FROM shared_expense_splits WHERE expense_id = ?', [expenseId]);
  for (const split of splits) {
    await database.runAsync(
      `INSERT INTO shared_expense_splits (expense_id, member_id, amount_cents)
       VALUES (?, ?, ?)`,
      [expenseId, split.memberId, split.amountCents]
    );
  }
}

export async function createSharedExpense(
  input: SharedExpenseInput,
  splits: SharedSplitRecord[],
  db?: SQLiteDatabase
): Promise<number> {
  const database = db ?? (await getDatabase());
  let expenseId = 0;
  await database.withTransactionAsync(async () => {
    const result = await database.runAsync(
      `INSERT INTO shared_expenses
         (space_id, period_id, description, total_amount_cents, date, paid_by_member_id, note, created_by_user_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.spaceId,
        input.periodId,
        input.description.trim(),
        input.totalAmountCents,
        input.date,
        input.paidByMemberId,
        input.note,
        input.createdByUserId,
      ]
    );
    expenseId = result.lastInsertRowId;
    await replaceSplits(database, expenseId, splits);
  });
  return expenseId;
}

export async function updateSharedExpense(
  id: number,
  input: SharedExpenseInput,
  splits: SharedSplitRecord[],
  db?: SQLiteDatabase
): Promise<void> {
  const database = db ?? (await getDatabase());
  await database.withTransactionAsync(async () => {
    await database.runAsync(
      `UPDATE shared_expenses
          SET description = ?, total_amount_cents = ?, date = ?, paid_by_member_id = ?, note = ?
        WHERE id = ?`,
      [
        input.description.trim(),
        input.totalAmountCents,
        input.date,
        input.paidByMemberId,
        input.note,
        id,
      ]
    );
    await replaceSplits(database, id, splits);
  });
}

export async function deleteSharedExpense(id: number, db?: SQLiteDatabase): Promise<void> {
  const database = db ?? (await getDatabase());
  await database.withTransactionAsync(async () => {
    await database.runAsync('DELETE FROM shared_expense_splits WHERE expense_id = ?', [id]);
    await database.runAsync('DELETE FROM shared_expenses WHERE id = ?', [id]);
  });
}

export async function savePeriodReport(
  input: {
    spaceId: number;
    periodId: number;
    report: SharedPeriodReportData;
    closedByMemberId: number | null;
  },
  db?: SQLiteDatabase
): Promise<number> {
  const database = db ?? (await getDatabase());
  const existing = await database.getFirstAsync<{ id: number }>(
    'SELECT id FROM shared_period_reports WHERE period_id = ? LIMIT 1',
    [input.periodId]
  );
  const reportJson = JSON.stringify(input.report);
  if (existing) {
    await database.runAsync(
      `UPDATE shared_period_reports
          SET report_json = ?, closed_at = ?, closed_by_member_id = ?
        WHERE id = ?`,
      [reportJson, input.report.closedAt, input.closedByMemberId, existing.id]
    );
    return existing.id;
  }
  const result = await database.runAsync(
    `INSERT INTO shared_period_reports
       (space_id, period_id, report_json, closed_at, closed_by_member_id)
     VALUES (?, ?, ?, ?, ?)`,
    [input.spaceId, input.periodId, reportJson, input.report.closedAt, input.closedByMemberId]
  );
  return result.lastInsertRowId;
}

export async function getPeriodReport(
  periodId: number,
  db?: SQLiteDatabase
): Promise<SharedPeriodReport | null> {
  const database = db ?? (await getDatabase());
  const row = await database.getFirstAsync<SharedReportRow>(
    'SELECT * FROM shared_period_reports WHERE period_id = ? ORDER BY id DESC LIMIT 1',
    [periodId]
  );
  if (!row) {
    return null;
  }
  return {
    id: row.id,
    uuid: row.uuid,
    spaceId: row.space_id,
    periodId: row.period_id,
    report: JSON.parse(row.report_json) as SharedPeriodReportData,
    closedAt: row.closed_at,
    closedByMemberId: row.closed_by_member_id,
    updatedAt: row.updated_at,
  };
}

export async function getPeriodsWithReports(
  spaceId: number,
  db?: SQLiteDatabase
): Promise<SharedPeriodReport[]> {
  const database = db ?? (await getDatabase());
  const rows = await database.getAllAsync<SharedReportRow>(
    'SELECT * FROM shared_period_reports WHERE space_id = ? ORDER BY closed_at DESC, id DESC',
    [spaceId]
  );
  return rows.map((row) => ({
    id: row.id,
    uuid: row.uuid,
    spaceId: row.space_id,
    periodId: row.period_id,
    report: JSON.parse(row.report_json) as SharedPeriodReportData,
    closedAt: row.closed_at,
    closedByMemberId: row.closed_by_member_id,
    updatedAt: row.updated_at,
  }));
}
