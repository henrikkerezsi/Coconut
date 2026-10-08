/// <reference types="node" />

import { DatabaseSync } from 'node:sqlite';
import { MIGRATIONS } from '../../src/database/migrations';
import { createBudget, deleteBudget, getMonthBudgets } from '../../src/database/budgets';
import { createTransaction, getMonthTransactions } from '../../src/database/transactions';
import { currentMonthKey, previousMonthKey } from '../../src/utils/date';

interface TestDb {
  getFirstAsync<T>(sql: string, params?: unknown[]): Promise<T | null>;
  getAllAsync<T>(sql: string, params?: unknown[]): Promise<T[]>;
  runAsync(sql: string, params?: unknown[]): Promise<unknown>;
  withTransactionAsync(callback: () => Promise<void>): Promise<void>;
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
      return Promise.resolve({ lastInsertRowId: Number(result.lastInsertRowid) });
    },
    async withTransactionAsync(callback: () => Promise<void>): Promise<void> {
      raw.exec('BEGIN');
      try {
        await callback();
        raw.exec('COMMIT');
      } catch (error) {
        raw.exec('ROLLBACK');
        throw error;
      }
    },
  };
}

function freshDb(): DatabaseSync {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = OFF');
  for (const migration of MIGRATIONS.sort((a, b) => a.id - b.id)) {
    db.exec(migration.sql);
  }
  return db;
}

describe('deleting a budget', () => {
  it('detaches the current month transactions and leaves past months intact', async () => {
    const raw = freshDb();
    const api = makeDbApi(raw) as never;
    const currentMonth = currentMonthKey();
    const pastMonth = previousMonthKey(currentMonth);

    await raw
      .prepare('INSERT INTO months (month_key, allowance_cents, starting_reserve_cents) VALUES (?, 100000, 50000)')
      .run(currentMonth);
    await raw
      .prepare('INSERT INTO months (month_key, allowance_cents, starting_reserve_cents) VALUES (?, 100000, 50000)')
      .run(pastMonth);

    const budgetId = await createBudget(
      { name: 'Food', defaultAmountCents: 20000, active: true, sortOrder: 0, color: '#E14B33' },
      api
    );
    await raw
      .prepare(
        'INSERT INTO month_budgets (month_key, budget_id, planned_amount_cents) VALUES (?, ?, ?)'
      )
      .run(currentMonth, budgetId, 20000);
    await raw
      .prepare(
        'INSERT INTO month_budgets (month_key, budget_id, planned_amount_cents) VALUES (?, ?, ?)'
      )
      .run(pastMonth, budgetId, 15000);

    await createTransaction(
      { date: `${currentMonth}-05`, amountCents: 12000, budgetId, merchant: 'Bakery', note: null, attachment: null },
      api
    );
    await createTransaction(
      { date: `${pastMonth}-05`, amountCents: 8000, budgetId, merchant: 'Bakery', note: null, attachment: null },
      api
    );

    await deleteBudget(budgetId, api);

    const [currentTransaction] = await getMonthTransactions(currentMonth, api);
    expect(currentTransaction.budgetId).toBeNull();

    const [pastTransaction] = await getMonthTransactions(pastMonth, api);
    expect(pastTransaction.budgetId).toBe(budgetId);

    expect(await getMonthBudgets(currentMonth, api)).toEqual([]);
    expect(await getMonthBudgets(pastMonth, api)).toHaveLength(1);
  });

  it('leaves transactions of other budgets untouched', async () => {
    const raw = freshDb();
    const api = makeDbApi(raw) as never;
    await raw
      .prepare('INSERT INTO months (month_key, allowance_cents, starting_reserve_cents) VALUES (?, 100000, 50000)')
      .run(currentMonthKey());

    const deleted = await createBudget(
      { name: 'Food', defaultAmountCents: 20000, active: true, sortOrder: 0, color: null },
      api
    );
    const kept = await createBudget(
      { name: 'Transit', defaultAmountCents: 10000, active: true, sortOrder: 1, color: null },
      api
    );

    await createTransaction(
      { date: `${currentMonthKey()}-05`, amountCents: 1000, budgetId: deleted, merchant: 'Bakery', note: null, attachment: null },
      api
    );
    await createTransaction(
      { date: `${currentMonthKey()}-06`, amountCents: 2000, budgetId: kept, merchant: 'Metro', note: null, attachment: null },
      api
    );

    await deleteBudget(deleted, api);

    const transactions = await getMonthTransactions(currentMonthKey(), api);
    expect(transactions.find((transaction) => transaction.budgetId === kept)?.budgetId).toBe(kept);
    expect(transactions.find((transaction) => transaction.merchant === 'Bakery')?.budgetId).toBeNull();
  });
});