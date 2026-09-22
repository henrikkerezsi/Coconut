/// <reference types="node" />

import { DatabaseSync } from 'node:sqlite';
import { MIGRATIONS } from '../../src/database/migrations';
import {
  createFixedExpense,
  getAllFixedExpenses,
  reorderFixedExpenses,
} from '../../src/database/fixedExpenses';

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

describe('fixed expense reordering', () => {
  it('rewrites sort orders so the list follows the given order', async () => {
    const raw = freshDb();
    const api = makeDbApi(raw) as never;
    const first = await createFixedExpense(
      {
        name: 'Rent',
        expectedAmountCents: 60000,
        kind: 'fixed',
        recurrence: 'monthly',
        estimationStrategy: 'manual',
        averageMonths: null,
        active: true,
        sortOrder: 0,
      },
      api
    );
    const second = await createFixedExpense(
      {
        name: 'Internet',
        expectedAmountCents: 3000,
        kind: 'fixed',
        recurrence: 'monthly',
        estimationStrategy: 'manual',
        averageMonths: null,
        active: true,
        sortOrder: 1,
      },
      api
    );
    const third = await createFixedExpense(
      {
        name: 'Electricity',
        expectedAmountCents: 8000,
        kind: 'variable',
        recurrence: 'monthly',
        estimationStrategy: 'average',
        averageMonths: 6,
        active: true,
        sortOrder: 2,
      },
      api
    );

    await reorderFixedExpenses([third, first, second], api);

    await expect(
      getAllFixedExpenses(api).then((items) => items.map((item) => item.name))
    ).resolves.toEqual(['Electricity', 'Rent', 'Internet']);
    const rows = await raw
      .prepare('SELECT id, sort_order FROM fixed_expenses ORDER BY sort_order')
      .all();
    expect(rows).toEqual([
      { id: third, sort_order: 0 },
      { id: first, sort_order: 1 },
      { id: second, sort_order: 2 },
    ]);
  });
});