/// <reference types="node" />

import { DatabaseSync } from 'node:sqlite';
import { MIGRATIONS } from '../../src/database/migrations';
import { createPlannedMonth } from '../../src/database/months';
import {
  getMonthPlanEvents,
  getPlannedDrawCents,
  recordMonthPlan,
} from '../../src/database/monthPlan';
import { getMonthBudgets } from '../../src/database/budgets';
import type { MonthPlanEvent } from '../../src/models';

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

const MONTH_KEY = '2026-10';

function seedBudgets(raw: DatabaseSync): void {
  raw
    .prepare(
      `INSERT INTO budgets (name, default_amount_cents, active, sort_order)
       VALUES ('Food', 20000, 1, 0), ('Fun', 10000, 1, 1)`
    )
    .run();
}

async function eventsOf(raw: DatabaseSync): Promise<MonthPlanEvent[]> {
  return getMonthPlanEvents(MONTH_KEY, makeDbApi(raw) as never);
}

async function planned(
  raw: DatabaseSync,
  budgetPlans: Record<number, number>,
  drawCents = 0
): Promise<void> {
  await createPlannedMonth({ monthKey: MONTH_KEY, budgetPlans, drawCents }, makeDbApi(raw) as never);
}

describe('the record of a month plan', () => {
  it('opens with the amount each budget starts the month planned at', async () => {
    const raw = freshDb();
    seedBudgets(raw);
    await planned(raw, { 1: 20000, 2: 15000 });

    const events = await getMonthPlanEvents(MONTH_KEY, makeDbApi(raw) as never);
    expect(
      events.map((event) => [event.kind, event.budgetId, event.newAmountCents])
    ).toEqual([
      ['initial', 1, 20000],
      ['initial', 2, 15000],
    ]);
  });

  it('opens with the draw the month starts planning with', async () => {
    const raw = freshDb();
    seedBudgets(raw);
    await planned(raw, { 1: 20000 }, 30000);

    expect(await getPlannedDrawCents(MONTH_KEY, makeDbApi(raw) as never)).toBe(30000);
    const events = await eventsOf(raw);
    expect(events.filter((event) => event.kind !== 'initial')).toMatchObject([
      {
        kind: 'draw',
        budgetId: null,
        previousAmountCents: 0,
        newAmountCents: 30000,
      },
    ]);
  });

  it('plans no draw at all when the month starts with none', async () => {
    const raw = freshDb();
    seedBudgets(raw);
    await planned(raw, { 1: 20000 });

    expect(await getPlannedDrawCents(MONTH_KEY, makeDbApi(raw) as never)).toBe(0);
    expect((await eventsOf(raw)).every((event) => event.kind === 'initial')).toBe(true);
  });

  it('records what a re-plan changed and leaves the untouched budget out of it', async () => {
    const raw = freshDb();
    seedBudgets(raw);
    await planned(raw, { 1: 20000, 2: 15000 });

    await recordMonthPlan(
      { monthKey: MONTH_KEY, plans: { 1: 35000, 2: 15000 }, drawCents: 0 },
      makeDbApi(raw) as never
    );

    const events = await getMonthPlanEvents(MONTH_KEY, makeDbApi(raw) as never);
    expect(events.map((event) => [event.kind, event.budgetId, event.newAmountCents])).toEqual([
      ['initial', 1, 20000],
      ['initial', 2, 15000],
      ['budget', 1, 35000],
    ]);
    const budgets = await getMonthBudgets(MONTH_KEY, makeDbApi(raw) as never);
    expect(budgets.map((budget) => budget.plannedAmountCents)).toEqual([35000, 15000]);
  });

  it('records a draw that was handed to a budget, naming the budget', async () => {
    const raw = freshDb();
    seedBudgets(raw);
    await planned(raw, { 1: 20000, 2: 10000 });

    await recordMonthPlan(
      { monthKey: MONTH_KEY, plans: { 1: 70000, 2: 10000 }, drawCents: 50000 },
      makeDbApi(raw) as never
    );

    const draw = (await getMonthPlanEvents(MONTH_KEY, makeDbApi(raw) as never)).find(
      (event) => event.kind === 'draw'
    );
    expect(draw).toMatchObject({
      previousAmountCents: 0,
      newAmountCents: 50000,
      fundedBudgetId: 1,
    });
  });

  it('records each step of a plan that moved twice, from the amount before it', async () => {
    const raw = freshDb();
    seedBudgets(raw);
    await planned(raw, { 1: 20000 });

    await recordMonthPlan(
      { monthKey: MONTH_KEY, plans: { 1: 30000 }, drawCents: 0 },
      makeDbApi(raw) as never
    );
    await recordMonthPlan(
      { monthKey: MONTH_KEY, plans: { 1: 25000 }, drawCents: 0 },
      makeDbApi(raw) as never
    );

    const changes = (await getMonthPlanEvents(MONTH_KEY, makeDbApi(raw) as never)).filter(
      (event) => event.kind === 'budget'
    );
    expect(
      changes.map((event) => [event.previousAmountCents, event.newAmountCents])
    ).toEqual([
      [20000, 30000],
      [30000, 25000],
    ]);
  });

  it('records a draw that was cut back', async () => {
    const raw = freshDb();
    seedBudgets(raw);
    await planned(raw, { 1: 20000 }, 40000);

    await recordMonthPlan(
      { monthKey: MONTH_KEY, plans: { 1: 20000 }, drawCents: 10000 },
      makeDbApi(raw) as never
    );

    expect(await getPlannedDrawCents(MONTH_KEY, makeDbApi(raw) as never)).toBe(10000);
    const draws = (await eventsOf(raw)).filter((event) => event.kind === 'draw');
    expect(draws.map((event) => [event.previousAmountCents, event.newAmountCents])).toEqual([
      [0, 40000],
      [40000, 10000],
    ]);
  });

  it('writes nothing when a re-plan changed nothing', async () => {
    const raw = freshDb();
    seedBudgets(raw);
    await planned(raw, { 1: 20000 }, 30000);

    await recordMonthPlan(
      { monthKey: MONTH_KEY, plans: { 1: 20000 }, drawCents: 30000 },
      makeDbApi(raw) as never
    );

    expect((await eventsOf(raw)).filter((event) => event.kind === 'budget')).toHaveLength(0);
    expect((await eventsOf(raw)).filter((event) => event.kind === 'draw')).toHaveLength(1);
  });

  it('opens the record of a month planned before it existed, at the amounts as they stand', async () => {
    const raw = freshDb();
    seedBudgets(raw);
    raw
      .prepare(
        `INSERT INTO months (month_key, allowance_cents, starting_reserve_cents, is_closed)
         VALUES (?, ?, ?, 0)`
      )
      .run(MONTH_KEY, 50000, 100000);
    raw
      .prepare(
        `INSERT INTO month_budgets (month_key, budget_id, planned_amount_cents)
         VALUES (?, 1, 27500), (?, 2, 10000)`
      )
      .run(MONTH_KEY, MONTH_KEY);
    expect(await getMonthPlanEvents(MONTH_KEY, makeDbApi(raw) as never)).toHaveLength(0);

    await recordMonthPlan(
      { monthKey: MONTH_KEY, plans: { 1: 27500, 2: 10000 }, drawCents: 0 },
      makeDbApi(raw) as never
    );

    const events = await getMonthPlanEvents(MONTH_KEY, makeDbApi(raw) as never);
    expect(
      events.map((event) => [event.kind, event.budgetId, event.newAmountCents])
    ).toEqual([
      ['initial', 1, 27500],
      ['initial', 2, 10000],
    ]);
  });

  it('keeps the start it already recorded when the month is re-planned again', async () => {
    const raw = freshDb();
    seedBudgets(raw);
    await planned(raw, { 1: 20000 });

    await recordMonthPlan(
      { monthKey: MONTH_KEY, plans: { 1: 40000 }, drawCents: 0 },
      makeDbApi(raw) as never
    );
    await recordMonthPlan(
      { monthKey: MONTH_KEY, plans: { 1: 50000 }, drawCents: 0 },
      makeDbApi(raw) as never
    );

    const initials = (await eventsOf(raw)).filter((event) => event.kind === 'initial');
    expect(initials.map((event) => [event.budgetId, event.newAmountCents])).toEqual([
      [1, 20000],
      [2, 10000],
    ]);
  });

  it('writes neither the amounts nor the record when the re-plan is rejected halfway', async () => {
    const raw = freshDb();
    seedBudgets(raw);
    await planned(raw, { 1: 20000, 2: 10000 });
    // Refuses the first amount the re-plan writes, after it has already opened
    // the record and is partway through applying the change.
    raw
      .prepare(
        `CREATE TRIGGER fail_a_replan BEFORE UPDATE ON month_budgets
         WHEN NEW.planned_amount_cents = 33000
         BEGIN SELECT RAISE(ABORT, 'replan rejected'); END`
      )
      .run();

    await expect(
      recordMonthPlan(
        { monthKey: MONTH_KEY, plans: { 1: 33000, 2: 10000 }, drawCents: 5000 },
        makeDbApi(raw) as never
      )
    ).rejects.toThrow('replan rejected');

    const budgets = await getMonthBudgets(MONTH_KEY, makeDbApi(raw) as never);
    expect(budgets.map((budget) => budget.plannedAmountCents)).toEqual([20000, 10000]);
    expect((await eventsOf(raw)).every((event) => event.kind === 'initial')).toBe(true);
    expect(await getPlannedDrawCents(MONTH_KEY, makeDbApi(raw) as never)).toBe(0);
  });

  it('gives every recorded event a sync identity of its own', async () => {
    const raw = freshDb();
    seedBudgets(raw);
    await planned(raw, { 1: 20000, 2: 10000 });
    await recordMonthPlan(
      { monthKey: MONTH_KEY, plans: { 1: 30000, 2: 10000 }, drawCents: 5000 },
      makeDbApi(raw) as never
    );

    const rows = raw
      .prepare('SELECT uuid, updated_at FROM month_budget_plan_events')
      .all() as unknown as { uuid: string | null; updated_at: string | null }[];
    expect(rows).toHaveLength(4);
    expect(rows.every((row) => typeof row.uuid === 'string' && row.uuid.length > 0)).toBe(true);
    expect(rows.every((row) => typeof row.updated_at === 'string')).toBe(true);
    expect(new Set(rows.map((row) => row.uuid)).size).toBe(4);
  });
});
