/// <reference types="node" />

import { DatabaseSync } from 'node:sqlite';
import { MIGRATIONS } from '../../src/database/migrations';
import {
  getLatestBudgetForMerchant,
  getTransaction,
  updateTransactionBudget,
} from '../../src/database/transactions';

interface TestDb {
  getFirstAsync<T>(sql: string, params?: unknown[]): Promise<T | null>;
  getAllAsync<T>(sql: string, params?: unknown[]): Promise<T[]>;
  runAsync(sql: string, params?: unknown[]): Promise<unknown>;
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
  };
}

function freshDb(): DatabaseSync {
  const db = new DatabaseSync(':memory:');
  for (const migration of MIGRATIONS.sort((a, b) => a.id - b.id)) {
    db.exec(migration.sql);
  }
  return db;
}

function seedMonth(db: DatabaseSync): void {
  db.exec(
    `INSERT INTO months (month_key, allowance_cents, starting_reserve_cents)
     VALUES ('2026-09', 100000, 0)`
  );
}

function seedBudget(db: DatabaseSync, name: string): number {
  db.exec(`INSERT INTO budgets (name, default_amount_cents) VALUES ('${name}', 50000)`);
  return (
    db.prepare('SELECT id FROM budgets WHERE name = ?').get(name) as { id: number }
  ).id;
}

function insertTransaction(
  db: DatabaseSync,
  merchant: string,
  budgetId: number | null,
  date: string
): number {
  db.exec(
    `INSERT INTO transactions (month_key, date, amount_cents, budget_id, merchant)
     VALUES ('2026-09', '${date}', 1000, ${budgetId === null ? 'NULL' : budgetId}, '${merchant}')`
  );
  return (
    db
      .prepare('SELECT id FROM transactions WHERE merchant = ? ORDER BY id DESC LIMIT 1')
      .get(merchant) as { id: number }
  ).id;
}

describe('getLatestBudgetForMerchant', () => {
  it('returns null when no transaction matches the merchant', async () => {
    const raw = freshDb();
    seedMonth(raw);

    expect(await getLatestBudgetForMerchant('Missing', makeDbApi(raw) as never)).toBeNull();
  });

  it('uses the budget of the newest matching transaction', async () => {
    const raw = freshDb();
    seedMonth(raw);
    const groceries = seedBudget(raw, 'Groceries');
    const eatingOut = seedBudget(raw, 'Eating out');
    insertTransaction(raw, 'Corner Shop', groceries, '2026-09-01');
    insertTransaction(raw, 'Corner Shop', eatingOut, '2026-09-20');

    const result = await getLatestBudgetForMerchant('Corner Shop', makeDbApi(raw) as never);

    expect(result).toBe(eatingOut);
  });

  it('returns null when the newest matching transaction has no budget', async () => {
    const raw = freshDb();
    seedMonth(raw);
    const groceries = seedBudget(raw, 'Groceries');
    insertTransaction(raw, 'Corner Shop', groceries, '2026-09-01');
    insertTransaction(raw, 'Corner Shop', null, '2026-09-20');

    const result = await getLatestBudgetForMerchant('Corner Shop', makeDbApi(raw) as never);

    expect(result).toBeNull();
  });

  it('does not match other merchant names', async () => {
    const raw = freshDb();
    seedMonth(raw);
    const groceries = seedBudget(raw, 'Groceries');
    insertTransaction(raw, 'Corner Shop', groceries, '2026-09-01');

    expect(await getLatestBudgetForMerchant('Other Shop', makeDbApi(raw) as never)).toBeNull();
  });
});

describe('updateTransactionBudget', () => {
  it('sets and clears the budget on a transaction', async () => {
    const raw = freshDb();
    seedMonth(raw);
    const groceries = seedBudget(raw, 'Groceries');
    const id = insertTransaction(raw, 'Corner Shop', null, '2026-09-01');

    await updateTransactionBudget(id, groceries, makeDbApi(raw) as never);
    expect((await getTransaction(id, makeDbApi(raw) as never))?.budgetId).toBe(groceries);

    await updateTransactionBudget(id, null, makeDbApi(raw) as never);
    expect((await getTransaction(id, makeDbApi(raw) as never))?.budgetId).toBeNull();
  });
});