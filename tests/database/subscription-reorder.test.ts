/// <reference types="node" />

import { DatabaseSync } from 'node:sqlite';
import { MIGRATIONS } from '../../src/database/migrations';
import {
  createSubscription,
  getAllSubscriptions,
  reorderSubscriptions,
} from '../../src/database/subscriptions';

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

describe('subscription reordering', () => {
  it('rewrites sort orders so the list follows the given order', async () => {
    const raw = freshDb();
    const api = makeDbApi(raw) as never;
    const first = await createSubscription(
      {
        name: 'Netflix',
        totalAmountCents: 12000,
        monthlyAmountCents: 1000,
        startMonth: '2025-01',
        endMonth: '2025-12',
        deductMonthly: true,
        active: true,
        sortOrder: 0,
      },
      api
    );
    const second = await createSubscription(
      {
        name: 'iCloud',
        totalAmountCents: 4800,
        monthlyAmountCents: 400,
        startMonth: '2025-01',
        endMonth: '2025-12',
        deductMonthly: true,
        active: true,
        sortOrder: 1,
      },
      api
    );

    await reorderSubscriptions([second, first], api);

    await expect(
      getAllSubscriptions(api).then((items) => items.map((item) => item.name))
    ).resolves.toEqual(['iCloud', 'Netflix']);
    const rows = await raw
      .prepare('SELECT id, sort_order FROM yearly_subscriptions ORDER BY sort_order')
      .all();
    expect(rows).toEqual([
      { id: second, sort_order: 0 },
      { id: first, sort_order: 1 },
    ]);
  });
});