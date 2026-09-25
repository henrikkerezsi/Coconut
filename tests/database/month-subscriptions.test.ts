/// <reference types="node" />

import { DatabaseSync } from 'node:sqlite';
import dayjs from 'dayjs';
import { MIGRATIONS } from '../../src/database/migrations';
import { materializeMonth } from '../../src/database/months';
import { getMonthSubscriptions } from '../../src/database/monthSubscriptions';
import { subscriptionChargesForMonth } from '../../src/services/subscription-service';
import { forecastMonth } from '../../src/services/forecast-service';
import type { Subscription } from '../../src/models';

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
      'INSERT INTO months (month_key, allowance_cents, starting_reserve_cents, is_closed) VALUES (?, ?, ?, 1)'
    )
    .run(monthKey, 50000, 0);
}

function insertSubscription(raw: DatabaseSync, overrides: Partial<Subscription> = {}): number {
  const subscription: Subscription = {
    id: 0,
    name: 'Streaming',
    totalAmountCents: 12000,
    monthlyAmountCents: 1000,
    startMonth: '2019-01',
    endMonth: '9999-12',
    deductMonthly: true,
    active: true,
    sortOrder: 0,
    ...overrides,
  };
  const row = raw
    .prepare(
      `INSERT INTO yearly_subscriptions
         (name, total_amount_cents, monthly_amount_cents, start_month, end_month, deduct_monthly, active, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`
    )
    .get(
      subscription.name,
      subscription.totalAmountCents,
      subscription.monthlyAmountCents,
      subscription.startMonth,
      subscription.endMonth,
      subscription.deductMonthly ? 1 : 0,
      subscription.active ? 1 : 0,
      subscription.sortOrder
    ) as { id: number };
  return row.id;
}

describe('month subscription charges', () => {
  it('freezes the current month charges when the month is materialized', async () => {
    const raw = freshDb();
    seedMonth(raw, CURRENT_MONTH);
    insertSubscription(raw, { name: 'Streaming', monthlyAmountCents: 1000 });
    insertSubscription(raw, { name: 'Gym', monthlyAmountCents: 2500, startMonth: CURRENT_MONTH });
    insertSubscription(raw, { name: 'Yearly', deductMonthly: false });

    await materializeMonth(CURRENT_MONTH, makeDbApi(raw) as never);

    const charges = await getMonthSubscriptions(CURRENT_MONTH, makeDbApi(raw) as never);
    expect(charges.map((charge) => [charge.name, charge.amountCents])).toEqual([
      ['Streaming', 1000],
      ['Gym', 2500],
    ]);
  });

  it('backfills charges for months that already exist', () => {
    const raw = new DatabaseSync(':memory:');
    raw.exec('PRAGMA foreign_keys = OFF;');
    raw.exec('PRAGMA recursive_triggers = OFF;');
    for (const migration of MIGRATIONS.filter((entry) => entry.id <= 12).sort((a, b) => a.id - b.id)) {
      raw.exec(migration.sql);
    }
    seedMonth(raw, PAST_MONTH);
    seedMonth(raw, '2020-02');
    insertSubscription(raw, { name: 'Streaming', monthlyAmountCents: 1000, endMonth: '2020-01' });
    insertSubscription(raw, { name: 'Cancelled', monthlyAmountCents: 500, active: false });

    for (const migration of MIGRATIONS.filter((entry) => entry.id > 12).sort((a, b) => a.id - b.id)) {
      raw.exec(migration.sql);
    }

    const charges = raw
      .prepare('SELECT month_key, name, amount_cents FROM month_subscriptions ORDER BY month_key')
      .all();
    expect(charges).toEqual([
      { month_key: '2020-01', name: 'Streaming', amount_cents: 1000 },
    ]);
  });

  it('keeps a closed month unchanged when a subscription is later deactivated', async () => {
    const raw = freshDb();
    seedMonth(raw, PAST_MONTH);
    insertSubscription(raw, { name: 'Streaming', monthlyAmountCents: 1000 });
    await materializeMonth(PAST_MONTH, makeDbApi(raw) as never);
    const before = await getMonthSubscriptions(PAST_MONTH, makeDbApi(raw) as never);
    expect(before).toHaveLength(1);

    raw.prepare('UPDATE yearly_subscriptions SET active = 0').run();
    insertSubscription(raw, { name: 'Added later', monthlyAmountCents: 700 });

    const after = await getMonthSubscriptions(PAST_MONTH, makeDbApi(raw) as never);
    expect(after).toHaveLength(1);
    expect(after[0].amountCents).toBe(1000);
  });

  it('keeps a closed month unchanged when a subscription amount is edited', async () => {
    const raw = freshDb();
    seedMonth(raw, PAST_MONTH);
    const id = insertSubscription(raw, { name: 'Streaming', monthlyAmountCents: 1000 });
    await materializeMonth(PAST_MONTH, makeDbApi(raw) as never);

    raw.prepare('UPDATE yearly_subscriptions SET monthly_amount_cents = 2500 WHERE id = ?').run(id);

    const charges = await getMonthSubscriptions(PAST_MONTH, makeDbApi(raw) as never);
    expect(charges[0].amountCents).toBe(1000);
  });

  it('replaces the current month charges when a subscription is removed', async () => {
    const raw = freshDb();
    seedMonth(raw, CURRENT_MONTH);
    const id = insertSubscription(raw, { name: 'Streaming', monthlyAmountCents: 1000 });
    await materializeMonth(CURRENT_MONTH, makeDbApi(raw) as never);
    expect(await getMonthSubscriptions(CURRENT_MONTH, makeDbApi(raw) as never)).toHaveLength(1);

    raw.prepare('DELETE FROM yearly_subscriptions WHERE id = ?').run(id);
    await materializeMonth(CURRENT_MONTH, makeDbApi(raw) as never);

    expect(await getMonthSubscriptions(CURRENT_MONTH, makeDbApi(raw) as never)).toEqual([]);
  });

  it('spends the frozen amount even after the subscription is deleted', () => {
    const charges = subscriptionChargesForMonth(
      [
        {
          id: 1,
          name: 'Streaming',
          totalAmountCents: 12000,
          monthlyAmountCents: 1000,
          startMonth: '2019-01',
          endMonth: '9999-12',
          deductMonthly: true,
          active: true,
          sortOrder: 0,
        },
      ],
      CURRENT_MONTH
    );
    const frozen = charges.map((charge) => ({
      id: 1,
      monthKey: CURRENT_MONTH,
      subscriptionId: charge.subscriptionId,
      name: charge.name,
      amountCents: charge.amountCents,
    }));
    const forecast = forecastMonth({
      month: { monthKey: CURRENT_MONTH, allowanceCents: 50000 },
      subscriptions: frozen,
      fixedExpenses: [],
      budgets: [],
      transactions: [],
    });
    expect(forecast.subscriptionTotalCents).toBe(1000);
    expect(forecast.actualSpendingCents).toBe(1000);
  });
});
