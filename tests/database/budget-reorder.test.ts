/// <reference types="node" />

import { DatabaseSync } from 'node:sqlite';
import { MIGRATIONS } from '../../src/database/migrations';
import { createBudget, getAllBudgets, reorderBudgets } from '../../src/database/budgets';

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
  for (const migration of MIGRATIONS.sort((a, b) => a.id - b.id)) {
    db.exec(migration.sql);
  }
  return db;
}

describe('budget reordering', () => {
  it('rewrites sort orders so the list follows the given order', async () => {
    const raw = freshDb();
    const api = makeDbApi(raw) as never;
    const first = await createBudget(
      { name: 'Food', defaultAmountCents: 20000, active: true, sortOrder: 0, color: '#E14B33' },
      api
    );
    const second = await createBudget(
      { name: 'Transit', defaultAmountCents: 10000, active: true, sortOrder: 1, color: '#E07F1F' },
      api
    );
    const third = await createBudget(
      { name: 'Fun', defaultAmountCents: 5000, active: true, sortOrder: 2, color: '#16A08F' },
      api
    );

    await reorderBudgets([third, first, second], api);

    await expect(getAllBudgets(api).then((b) => b.map((budget) => budget.name))).resolves.toEqual([
      'Fun',
      'Food',
      'Transit',
    ]);
    const rows = await raw.prepare('SELECT id, sort_order FROM budgets ORDER BY sort_order').all();
    expect(rows).toEqual([
      { id: third, sort_order: 0 },
      { id: first, sort_order: 1 },
      { id: second, sort_order: 2 },
    ]);
  });

  it('leaves missing budgets untouched when only a subset is passed', async () => {
    const raw = freshDb();
    const api = makeDbApi(raw) as never;
    const first = await createBudget(
      { name: 'Food', defaultAmountCents: 20000, active: true, sortOrder: 0, color: null },
      api
    );
    const second = await createBudget(
      { name: 'Transit', defaultAmountCents: 10000, active: true, sortOrder: 1, color: null },
      api
    );

    await reorderBudgets([second], api);

    const rows = await raw
      .prepare('SELECT id, sort_order FROM budgets ORDER BY sort_order')
      .all();
    expect(rows).toEqual([
      { id: first, sort_order: 0 },
      { id: second, sort_order: 0 },
    ]);
  });
});