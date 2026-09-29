/// <reference types="node" />

import { DatabaseSync } from 'node:sqlite';
import { MIGRATIONS } from '../../src/database/migrations';
import {
  createTransaction,
  getMonthTransactions,
  setTransactionRating,
  upsertSharedTransaction,
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

const MONTH_KEY = '2026-09';

function seedMonth(raw: DatabaseSync, monthKey = MONTH_KEY): void {
  raw
    .prepare(
      `INSERT INTO months (month_key, allowance_cents, starting_reserve_cents, is_closed)
       VALUES (?, ?, ?, 0)`
    )
    .run(monthKey, 50000, 0);
}

function seed(raw: DatabaseSync): number {
  seedMonth(raw);
  return Number(
    raw
      .prepare(
        `INSERT INTO transactions (month_key, date, amount_cents, budget_id, merchant, note)
         VALUES (?, ?, ?, NULL, 'Coffee', NULL)`
      )
      .run(MONTH_KEY, '2026-09-14', 4500).lastInsertRowid
  );
}

describe('transaction ratings', () => {
  it('has no rating until one is chosen', async () => {
    const raw = freshDb();
    const id = seed(raw);
    const [transaction] = await getMonthTransactions(MONTH_KEY, makeDbApi(raw) as never);
    expect(transaction.id).toBe(id);
    expect(transaction.rating).toBeNull();
  });

  it('stores a chosen rating', async () => {
    const raw = freshDb();
    const id = seed(raw);
    await setTransactionRating(id, 'regret', makeDbApi(raw) as never);
    const [transaction] = await getMonthTransactions(MONTH_KEY, makeDbApi(raw) as never);
    expect(transaction.rating).toBe('regret');
  });

  it('replaces a rating when the user changes their mind', async () => {
    const raw = freshDb();
    const id = seed(raw);
    await setTransactionRating(id, 'good', makeDbApi(raw) as never);
    await setTransactionRating(id, 'neutral', makeDbApi(raw) as never);
    const [transaction] = await getMonthTransactions(MONTH_KEY, makeDbApi(raw) as never);
    expect(transaction.rating).toBe('neutral');
  });

  it('keeps ratings per transaction', async () => {
    const raw = freshDb();
    const first = seed(raw);
    const second = Number(
      raw
        .prepare(
          `INSERT INTO transactions (month_key, date, amount_cents, budget_id, merchant, note)
           VALUES (?, ?, ?, NULL, 'Train ticket', NULL)`
        )
        .run(MONTH_KEY, '2026-09-15', 12000).lastInsertRowid
    );
    await setTransactionRating(first, 'good', makeDbApi(raw) as never);
    await setTransactionRating(second, 'regret', makeDbApi(raw) as never);
    const transactions = await getMonthTransactions(MONTH_KEY, makeDbApi(raw) as never);
    const byId = new Map(transactions.map((entry) => [entry.id, entry.rating]));
    expect(byId.get(first)).toBe('good');
    expect(byId.get(second)).toBe('regret');
  });

  it('treats an unset rating as neutral when read back through the row mapper', async () => {
    const raw = freshDb();
    seed(raw);
    const [transaction] = await getMonthTransactions(MONTH_KEY, makeDbApi(raw) as never);
    expect(transaction.rating ?? 'neutral').toBe('neutral');
  });

  it('rejects a rating outside the allowed set', async () => {
    const raw = freshDb();
    const id = seed(raw);
    expect(() =>
      raw
        .prepare('UPDATE transactions SET rating = ? WHERE id = ?')
        .run('amazing', id)
    ).toThrow();
  });

  it('leaves newly created transactions unrated', async () => {
    const raw = freshDb();
    seed(raw);
    const id = await createTransaction(
      {
        date: '2026-09-20',
        amountCents: 2500,
        budgetId: null,
        merchant: 'Bakery',
        note: null,
        attachment: null,
      },
      makeDbApi(raw) as never
    );
    const [transaction] = await getMonthTransactions(MONTH_KEY, makeDbApi(raw) as never);
    expect(transaction.id).toBe(id);
    expect(transaction.rating).toBeNull();
  });

  it('keeps a rating when the shared expense is re-derived', async () => {
    const raw = freshDb();
    seedMonth(raw);
    const db = makeDbApi(raw) as never;
    const input = {
      date: '2026-09-18',
      amountCents: 3000,
      budgetId: null,
      merchant: 'Shared dinner',
      note: null,
      attachment: null,
    };
    const id = await upsertSharedTransaction('shared-expense-1', input, db);
    await setTransactionRating(id, 'regret', db);

    await upsertSharedTransaction(
      'shared-expense-1',
      { ...input, amountCents: 3400, note: 'with tip' },
      db
    );

    const [transaction] = await getMonthTransactions(MONTH_KEY, db);
    expect(transaction.id).toBe(id);
    expect(transaction.amountCents).toBe(3400);
    expect(transaction.rating).toBe('regret');
  });

  it('keeps a rating when the shared expense moves to another month', async () => {
    const raw = freshDb();
    seedMonth(raw);
    seedMonth(raw, '2026-10');
    const db = makeDbApi(raw) as never;
    const id = await upsertSharedTransaction(
      'shared-expense-2',
      { date: '2026-09-30', amountCents: 2000, budgetId: null, merchant: 'Taxi', note: null, attachment: null },
      db
    );
    await setTransactionRating(id, 'good', db);

    await upsertSharedTransaction(
      'shared-expense-2',
      { date: '2026-10-01', amountCents: 2000, budgetId: null, merchant: 'Taxi', note: null, attachment: null },
      db
    );

    expect((await getMonthTransactions(MONTH_KEY, db))).toHaveLength(0);
    const [moved] = await getMonthTransactions('2026-10', db);
    expect(moved.id).toBe(id);
    expect(moved.rating).toBe('good');
  });
});
