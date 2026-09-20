/// <reference types="node" />

import { DatabaseSync } from 'node:sqlite';
import dayjs from 'dayjs';
import { MIGRATIONS } from '../../src/database/migrations';
import { deleteBudget } from '../../src/database/budgets';
import { deleteFixedExpense } from '../../src/database/fixedExpenses';

interface TestDb {
  getFirstAsync<T>(sql: string, params?: unknown[]): Promise<T | null>;
  getAllAsync<T>(sql: string, params?: unknown[]): Promise<T[]>;
  runAsync(sql: string, params?: unknown[]): Promise<unknown>;
  withTransactionAsync<T>(task: () => Promise<T>): Promise<T>;
}

type SqlParams = Parameters<ReturnType<DatabaseSync['prepare']>['get']>;

function makeDbApi(raw: DatabaseSync): TestDb {
  return {
    getFirstAsync<T>(sql: string, params: unknown[] = []): Promise<T | null> {
      const row = raw.prepare(sql).get(...(params as SqlParams));
      return Promise.resolve((row as T | undefined) ?? null);
    },
    getAllAsync<T>(sql: string, params: unknown[] = []): Promise<T[]> {
      const rows = (raw.prepare(sql).all(...(params as SqlParams)) as T[]) ?? [];
      return Promise.resolve(rows);
    },
    runAsync(sql: string, params: unknown[] = []): Promise<unknown> {
      const result = raw.prepare(sql).run(...(params as SqlParams));
      return Promise.resolve({
        lastInsertRowId: Number(result.lastInsertRowid),
        changes: Number(result.changes),
      });
    },
    withTransactionAsync<T>(task: () => Promise<T>): Promise<T> {
      return task();
    },
  };
}

function freshDb(): DatabaseSync {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = OFF;');
  db.exec('PRAGMA recursive_triggers = OFF;');
  for (const migration of MIGRATIONS.sort((a, b) => a.id - b.id)) {
    db.exec(migration.sql);
  }
  return db;
}

const CURRENT_MONTH = dayjs().format('YYYY-MM');
const PAST_MONTH = '2020-01';

function seedMonth(raw: DatabaseSync, monthKey: string): void {
  raw
    .prepare(
      'INSERT INTO months (month_key, allowance_cents, starting_reserve_cents, is_closed) VALUES (?, ?, ?, 0)'
    )
    .run(monthKey, 50000, 0);
}

describe('deleteBudget', () => {
  it('removes the definition and the current-month allocation, keeps past months', async () => {
    const raw = freshDb();
    seedMonth(raw, CURRENT_MONTH);
    seedMonth(raw, PAST_MONTH);
    const budgetId = Number(
      (
        raw
          .prepare(
            'INSERT INTO budgets (name, default_amount_cents, active, sort_order) VALUES (?, ?, 1, 0) RETURNING id'
          )
          .get('Groceries', 50000) as { id: number }
      ).id
    );
    raw
      .prepare('INSERT INTO month_budgets (month_key, budget_id, planned_amount_cents) VALUES (?, ?, ?)')
      .run(CURRENT_MONTH, budgetId, 50000);
    raw
      .prepare('INSERT INTO month_budgets (month_key, budget_id, planned_amount_cents) VALUES (?, ?, ?)')
      .run(PAST_MONTH, budgetId, 45000);
    raw
      .prepare(
        'INSERT INTO transactions (month_key, date, amount_cents, budget_id, merchant) VALUES (?, ?, ?, ?, ?)'
      )
      .run(CURRENT_MONTH, '2026-09-10', 1200, budgetId, 'Shop');

    await deleteBudget(budgetId, makeDbApi(raw) as never);

    expect(
      (raw.prepare('SELECT COUNT(*) AS n FROM budgets WHERE id = ?').get(budgetId) as { n: number }).n
    ).toBe(0);
    const remaining = raw
      .prepare('SELECT month_key FROM month_budgets ORDER BY month_key')
      .all() as Array<{ month_key: string }>;
    expect(remaining).toEqual([{ month_key: PAST_MONTH }]);
    expect(
      (raw.prepare('SELECT COUNT(*) AS n FROM transactions WHERE budget_id = ?').get(budgetId) as { n: number })
        .n
    ).toBe(1);
  });
});

describe('deleteFixedExpense', () => {
  it('removes the definition and the current-month instance, keeps past months', async () => {
    const raw = freshDb();
    seedMonth(raw, CURRENT_MONTH);
    seedMonth(raw, PAST_MONTH);
    const fixedId = Number(
      (
        raw
          .prepare(
            'INSERT INTO fixed_expenses (name, expected_amount_cents, kind, recurrence, estimation_strategy, active, sort_order) VALUES (?, ?, ?, ?, ?, 1, 0) RETURNING id'
          )
          .get('Rent', 120000, 'fixed', 'monthly', 'manual') as { id: number }
      ).id
    );
    raw
      .prepare(
        'INSERT INTO month_fixed_expenses (month_key, fixed_expense_id, expected_amount_cents, actual_amount_cents) VALUES (?, ?, ?, NULL)'
      )
      .run(CURRENT_MONTH, fixedId, 120000);
    raw
      .prepare(
        'INSERT INTO month_fixed_expenses (month_key, fixed_expense_id, expected_amount_cents, actual_amount_cents) VALUES (?, ?, ?, 119900)'
      )
      .run(PAST_MONTH, fixedId, 120000);

    await deleteFixedExpense(fixedId, makeDbApi(raw) as never);

    expect(
      (
        raw.prepare('SELECT COUNT(*) AS n FROM fixed_expenses WHERE id = ?').get(fixedId) as {
          n: number;
        }
      ).n
    ).toBe(0);
    const remaining = raw
      .prepare('SELECT month_key, actual_amount_cents FROM month_fixed_expenses ORDER BY month_key')
      .all() as Array<{ month_key: string; actual_amount_cents: number }>;
    expect(remaining).toEqual([{ month_key: PAST_MONTH, actual_amount_cents: 119900 }]);
  });
});