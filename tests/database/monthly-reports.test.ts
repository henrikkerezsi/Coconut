/// <reference types="node" />

import { DatabaseSync } from 'node:sqlite';
import { MIGRATIONS } from '../../src/database/migrations';
import { createPlannedMonth } from '../../src/database/months';
import { recordMonthPlan } from '../../src/database/monthPlan';
import { getMonthlyReport } from '../../src/database/monthlyReports';
import type { MonthKey } from '../../src/models';

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
    async withTransactionAsync<T>(task: () => Promise<T>): Promise<T> {
      raw.exec('BEGIN');
      try {
        const result = await task();
        raw.exec('COMMIT');
        return result;
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

const MONTH_KEY: MonthKey = '2026-10';

function seedBudgets(raw: DatabaseSync): void {
  raw
    .prepare(
      `INSERT INTO budgets (name, default_amount_cents, active, sort_order)
       VALUES ('Food', 20000, 1, 0), ('Fun', 10000, 1, 1)`
    )
    .run();
}

async function planMonth(raw: DatabaseSync, drawCents: number): Promise<void> {
  const db = makeDbApi(raw) as never;
  await createPlannedMonth(
    { monthKey: MONTH_KEY, budgetPlans: { 1: 20000, 2: 15000 }, drawCents },
    db
  );
}

function closeMonth(raw: DatabaseSync): void {
  raw
    .prepare(`UPDATE months SET is_closed = 1, closed_at = ? WHERE month_key = ?`)
    .run('2026-11-01T00:00:00.000Z', MONTH_KEY);
}

describe('getMonthlyReport', () => {
  it('carries the plan record into the report', async () => {
    const raw = freshDb();
    seedBudgets(raw);
    await planMonth(raw, 20000);
    await recordMonthPlan(
      { monthKey: MONTH_KEY, plans: { 1: 30000, 2: 15000 }, drawCents: 35000 },
      makeDbApi(raw) as never
    );
    closeMonth(raw);

    const report = await getMonthlyReport(MONTH_KEY, makeDbApi(raw) as never);

    const food = report?.budgets.find((entry) => entry.name === 'Food');
    expect(food?.startingCents).toBe(20000);
    expect(food?.plannedCents).toBe(30000);
    const fun = report?.budgets.find((entry) => entry.name === 'Fun');
    expect(fun?.startingCents).toBe(15000);
    expect(fun?.plannedCents).toBe(15000);
    expect(report?.initialDrawCents).toBe(20000);
    expect(report?.endingDrawCents).toBe(35000);
  });

  it('reports an unknown starting amount for a month with no plan record', async () => {
    const raw = freshDb();
    seedBudgets(raw);
    raw
      .prepare(
        `INSERT INTO months (month_key, allowance_cents, starting_reserve_cents)
         VALUES (?, 100000, 0)`
      )
      .run(MONTH_KEY);
    raw
      .prepare(`INSERT INTO month_budgets (month_key, budget_id, planned_amount_cents) VALUES (?, 1, 20000)`)
      .run(MONTH_KEY);
    closeMonth(raw);

    const report = await getMonthlyReport(MONTH_KEY, makeDbApi(raw) as never);

    expect(report?.budgets[0].startingCents).toBeNull();
    expect(report?.budgets[0].plannedCents).toBe(20000);
    expect(report?.initialDrawCents).toBeNull();
    expect(report?.endingDrawCents).toBeNull();
  });

  it('has no report for a month that is not closed yet', async () => {
    const raw = freshDb();
    seedBudgets(raw);
    await planMonth(raw, 0);

    expect(await getMonthlyReport(MONTH_KEY, makeDbApi(raw) as never)).toBeNull();
  });
});
