import type { SQLiteDatabase } from 'expo-sqlite';

import type { MonthKey, MonthPlanEvent, MonthPlanEventKind } from '../models';
import { getDatabase } from './database';
import { getMonthBudgets, setMonthBudgetPlanned } from './budgets';
import { diffMonthPlan, fundedBudgetIdForDraw } from '../services/month-planning-service';

interface MonthPlanEventRow {
  id: number;
  month_key: MonthKey;
  kind: MonthPlanEventKind;
  budget_id: number | null;
  previous_amount_cents: number;
  new_amount_cents: number;
  funded_budget_id: number | null;
  created_at: string;
}

function rowToEvent(row: MonthPlanEventRow): MonthPlanEvent {
  return {
    id: row.id,
    monthKey: row.month_key,
    kind: row.kind,
    budgetId: row.budget_id,
    previousAmountCents: row.previous_amount_cents,
    newAmountCents: row.new_amount_cents,
    fundedBudgetId: row.funded_budget_id,
    createdAt: row.created_at,
  };
}

/** The whole record for a month, oldest first. */
export async function getMonthPlanEvents(
  monthKey: MonthKey,
  db?: SQLiteDatabase
): Promise<MonthPlanEvent[]> {
  const database = db ?? (await getDatabase());
  const rows = await database.getAllAsync<MonthPlanEventRow>(
    `SELECT id, month_key, kind, budget_id, previous_amount_cents, new_amount_cents,
            funded_budget_id, created_at
       FROM month_budget_plan_events
      WHERE month_key = ?
      ORDER BY id ASC`,
    [monthKey]
  );
  return rows.map(rowToEvent);
}

/**
 * The planned reserve draw as it currently stands: the newest draw in the
 * record, or nothing planned when there has never been one.
 *
 * The draw is deliberately not stored on the month. This is where it lives, so
 * that raising it is a recorded decision rather than a number that quietly
 * changed.
 */
export async function getPlannedDrawCents(
  monthKey: MonthKey,
  db?: SQLiteDatabase
): Promise<number> {
  const database = db ?? (await getDatabase());
  const row = await database.getFirstAsync<{ new_amount_cents: number }>(
    `SELECT new_amount_cents FROM month_budget_plan_events
      WHERE month_key = ? AND kind = 'draw'
      ORDER BY id DESC
      LIMIT 1`,
    [monthKey]
  );
  return row?.new_amount_cents ?? 0;
}

async function insertEvent(
  event: Omit<MonthPlanEvent, 'id' | 'createdAt'>,
  db: SQLiteDatabase
): Promise<void> {
  await db.runAsync(
    `INSERT INTO month_budget_plan_events
       (month_key, kind, budget_id, previous_amount_cents, new_amount_cents, funded_budget_id)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      event.monthKey,
      event.kind,
      event.budgetId,
      event.previousAmountCents,
      event.newAmountCents,
      event.fundedBudgetId,
    ]
  );
}

/**
 * Opens the record for a month: one `initial` row per budget at the amount it
 * starts the month planned at, and one `draw` row for the draw it starts with.
 * This is what makes the amount a budget started at answerable later.
 *
 * Writes inside the caller's transaction rather than opening its own, because it
 * runs as part of creating the month.
 */
export async function writeMonthPlanStart(
  monthKey: MonthKey,
  budgets: { budgetId: number; plannedAmountCents: number }[],
  drawCents: number,
  db: SQLiteDatabase
): Promise<void> {
  for (const budget of budgets) {
    await insertEvent(
      {
        monthKey,
        kind: 'initial',
        budgetId: budget.budgetId,
        previousAmountCents: 0,
        newAmountCents: budget.plannedAmountCents,
        fundedBudgetId: null,
      },
      db
    );
  }
  if (drawCents !== 0) {
    await insertEvent(
      {
        monthKey,
        kind: 'draw',
        budgetId: null,
        previousAmountCents: 0,
        newAmountCents: drawCents,
        fundedBudgetId: null,
      },
      db
    );
  }
}

/**
 * Opens the record for a month that was planned before the record existed,
 * without claiming anything about how it got there: the budgets that have no
 * `initial` row yet open at the amount they stand at.
 *
 * A month that already has a record is left exactly as it is, so re-planning
 * never rewrites the start it already recorded. It runs against state the
 * caller has just read inside the same transaction, so the opening point and the
 * change recorded after it can never disagree.
 */
async function openMonthPlanRecord(
  monthKey: MonthKey,
  currentPlans: { budgetId: number; plannedAmountCents: number }[],
  db: SQLiteDatabase
): Promise<void> {
  for (const plan of currentPlans) {
    const existing = await db.getFirstAsync<{ id: number }>(
      `SELECT id FROM month_budget_plan_events
        WHERE month_key = ? AND kind = 'initial' AND budget_id = ?
        LIMIT 1`,
      [monthKey, plan.budgetId]
    );
    if (existing) {
      continue;
    }
    await insertEvent(
      {
        monthKey,
        kind: 'initial',
        budgetId: plan.budgetId,
        previousAmountCents: 0,
        newAmountCents: plan.plannedAmountCents,
        fundedBudgetId: null,
      },
      db
    );
  }
}

export interface MonthPlanUpdate {
  monthKey: MonthKey;
  /** The full plan the user has just committed to, by budget. */
  plans: Record<number, number>;
  /** The planned reserve draw the user has just committed to. */
  drawCents: number;
}

/**
 * Applies an explicit re-plan: the month's budget amounts are written and the
 * change is recorded. Nothing moves money and the reserve is not touched; the
 * closing rule remains the only thing that moves the reserve.
 *
 * What counts as a change is decided by the planning service, from the amounts
 * the month stands at inside this transaction, so the record can never claim a
 * change that did not happen or miss one that did. Written as one transaction
 * so a month can never end up with amounts that do not match the record of them.
 */
export async function recordMonthPlan(
  update: MonthPlanUpdate,
  db?: SQLiteDatabase
): Promise<void> {
  const database = db ?? (await getDatabase());
  await database.withTransactionAsync(async () => {
    const currentRows = await getMonthBudgets(update.monthKey, database);
    const previousDrawCents = await getPlannedDrawCents(update.monthKey, database);
    await openMonthPlanRecord(
      update.monthKey,
      currentRows.map((row) => ({
        budgetId: row.budgetId,
        plannedAmountCents: row.plannedAmountCents,
      })),
      database
    );
    const diff = diffMonthPlan(
      currentRows.map((row) => ({
        budgetId: row.budgetId,
        plannedAmountCents: row.plannedAmountCents,
      })),
      update.plans,
      previousDrawCents,
      update.drawCents
    );

    for (const change of diff.budgetChanges) {
      const row = currentRows.find((entry) => entry.budgetId === change.budgetId);
      if (!row) {
        continue;
      }
      await setMonthBudgetPlanned(row.id, change.newAmountCents, database);
      await insertEvent(
        {
          monthKey: update.monthKey,
          kind: 'budget',
          budgetId: change.budgetId,
          previousAmountCents: change.previousAmountCents,
          newAmountCents: change.newAmountCents,
          fundedBudgetId: null,
        },
        database
      );
    }

    if (diff.drawChanged) {
      await insertEvent(
        {
          monthKey: update.monthKey,
          kind: 'draw',
          budgetId: null,
          previousAmountCents: previousDrawCents,
          newAmountCents: update.drawCents,
          fundedBudgetId: fundedBudgetIdForDraw(diff),
        },
        database
      );
    }
  });
}
