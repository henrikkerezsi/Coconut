import type { MonthBudget, MonthFixedExpense, MonthKey, MonthSubscription } from '../models';
import { forecastMonth } from './forecast-service';
import { remainingForBudget } from './allowance-service';

export interface MonthPlanInput {
  monthKey: MonthKey;
  allowanceCents: number;
  /**
   * What the user intends to move through the reserve to have more to spend this
   * month. A positive amount is drawn out of the reserve; a negative amount is
   * extra they mean to set aside on top of what the month leaves over, which
   * frees that much up for the plan instead.
   *
   * It is a planning figure only: nothing moves, nothing is recorded and the
   * reserve balance is untouched. The real movement is decided at month end by
   * the automatic rule, which may well be no movement at all.
   */
  drawCents: number;
  fixedExpenses: MonthFixedExpense[];
  subscriptions: MonthSubscription[];
  budgets: MonthBudget[];
}

export interface MonthPlan {
  monthKey: MonthKey;
  allowanceCents: number;
  drawCents: number;
  /** Allowance plus the planned draw: what the month has to spend. */
  availableCents: number;
  expectedFixedCents: number;
  subscriptionCents: number;
  /** Expected fixed expenses and subscriptions, deducted before planning. */
  committedCents: number;
  budgetPlannedCents: number;
  /** What the month has to spread across its budgets once the commitments are out. */
  distributableCents: number;
  /** What is left of `availableCents` once the commitments and the plan are in. */
  remainingCents: number;
  /** How far the plan exceeds what is available; zero while it fits. */
  overPlannedCents: number;
}

/**
 * Plans a month that may not exist yet. The fixed expenses and subscriptions are
 * their expected amounts, nothing has been spent, and the plan is checked
 * against what the month can actually afford, so a user can never plan away
 * money that is not there.
 *
 * The draw is folded into the allowance the forecast runs on, because that is
 * exactly what it is for this calculation: extra money to spend this month. A
 * negative draw is extra the user means to set aside, so it raises what there is
 * to spend instead. Either way it is deliberately absent from the month that
 * gets stored.
 */
export function planMonth(input: MonthPlanInput): MonthPlan {
  const spendableCents = input.allowanceCents + input.drawCents;
  const forecast = forecastMonth({
    month: { monthKey: input.monthKey, allowanceCents: spendableCents },
    fixedExpenses: input.fixedExpenses,
    budgets: input.budgets,
    subscriptions: input.subscriptions,
    transactions: [],
    income: [],
  });
  const remainingCents = forecast.allowanceVsPlanCents;
  return {
    monthKey: input.monthKey,
    allowanceCents: input.allowanceCents,
    drawCents: input.drawCents,
    availableCents: forecast.availableCents,
    expectedFixedCents: forecast.fixedExpectedTotalCents,
    subscriptionCents: forecast.subscriptionTotalCents,
    committedCents: forecast.fixedExpectedTotalCents + forecast.subscriptionTotalCents,
    budgetPlannedCents: forecast.budgetPlannedTotalCents,
    distributableCents: forecast.allowanceVsPlanCents + forecast.budgetPlannedTotalCents,
    remainingCents,
    overPlannedCents: Math.max(0, -remainingCents),
  };
}

/**
 * Keeps a planned reserve movement within what the reserve can actually do: it
 * cannot draw past what the reserve holds. A negative amount is the user setting
 * extra aside, which the reserve takes without limit, so it is left alone.
 */
export function clampDrawCents(drawCents: number, startingReserveCents: number): number {
  return Math.min(drawCents, startingReserveCents);
}

export interface BudgetPlanChange {
  budgetId: number;
  previousAmountCents: number;
  newAmountCents: number;
}

export interface MonthPlanDiff {
  budgetChanges: BudgetPlanChange[];
  previousDrawCents: number;
  nextDrawCents: number;
  /** True when the draw moved; only then is there a draw to record. */
  drawChanged: boolean;
  /** True when the re-plan would not change anything, and so records nothing. */
  unchanged: boolean;
}

/**
 * What an explicit re-plan actually did, given the amounts the month stands at
 * now. Only real changes appear: a budget the user left alone is not an event,
 * and a draw that did not move is not an event, so the record stays a record of
 * decisions rather than of saves.
 */
export function diffMonthPlan(
  current: { budgetId: number; plannedAmountCents: number }[],
  next: Record<number, number>,
  previousDrawCents: number,
  nextDrawCents: number
): MonthPlanDiff {
  const currentByBudget = new Map(
    current.map((entry) => [entry.budgetId, entry.plannedAmountCents])
  );

  const budgetChanges: BudgetPlanChange[] = [];
  for (const [budgetIdKey, newAmountCents] of Object.entries(next)) {
    const budgetId = Number(budgetIdKey);
    const previousAmountCents = currentByBudget.get(budgetId);
    if (previousAmountCents === undefined || previousAmountCents === newAmountCents) {
      continue;
    }
    budgetChanges.push({ budgetId, previousAmountCents, newAmountCents });
  }

  const drawChanged = previousDrawCents !== nextDrawCents;
  return {
    budgetChanges,
    previousDrawCents,
    nextDrawCents,
    drawChanged,
    unchanged: budgetChanges.length === 0 && !drawChanged,
  };
}

/**
 * The budget a raised draw paid for: the one that grew by exactly what the draw
 * grew by, which is the user handing the extra to a single budget. A draw raised
 * on its own, or one whose difference was spread over several budgets or over
 * none of them, is recorded without a budget, because there is no single budget
 * it was for. Only a raise can fund anything; lowering a draw cannot.
 */
export function fundedBudgetIdForDraw(diff: MonthPlanDiff): number | null {
  if (!diff.drawChanged || diff.nextDrawCents <= diff.previousDrawCents) {
    return null;
  }
  const drawDeltaCents = diff.nextDrawCents - diff.previousDrawCents;
  return (
    diff.budgetChanges.find(
      (change) => change.newAmountCents - change.previousAmountCents === drawDeltaCents
    )?.budgetId ?? null
  );
}

/**
 * The most a single budget may be planned at: what the month has left once the
 * expected fixed expenses, the subscriptions and every other budget are paid
 * for. Negative means the month is already over-planned, so the budget gets
 * nothing more.
 */
export function budgetHeadroomCents(
  plan: MonthPlan,
  budgets: { id: number; amountCents: number }[],
  budgetId: number
): number {
  return remainingForBudget({
    allowanceCents: plan.allowanceCents + plan.drawCents,
    expectedFixedExpensesCents: plan.expectedFixedCents,
    subscriptionCents: plan.subscriptionCents,
    budgets,
    excludeBudgetId: budgetId,
  });
}

/** The plan as month budget rows, which is the shape the forecast and the database share. */
export function toMonthBudgets(
  monthKey: MonthKey,
  plans: { budgetId: number; plannedAmountCents: number }[]
): MonthBudget[] {
  return plans.map((plan, index) => ({
    id: index,
    monthKey,
    budgetId: plan.budgetId,
    plannedAmountCents: plan.plannedAmountCents,
  }));
}
