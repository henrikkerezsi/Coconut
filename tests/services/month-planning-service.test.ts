import type { MonthBudget, MonthFixedExpense, MonthSubscription } from '../../src/models';
import {
  budgetHeadroomCents,
  clampDrawCents,
  diffMonthPlan,
  fundedBudgetIdForDraw,
  planMonth,
  toMonthBudgets,
} from '../../src/services/month-planning-service';

const MONTH_KEY = '2026-10';

function fixedExpense(id: number, expectedAmountCents: number): MonthFixedExpense {
  return { id, monthKey: MONTH_KEY, fixedExpenseId: id, expectedAmountCents, actualAmountCents: null };
}

function subscription(id: number, amountCents: number): MonthSubscription {
  return { id, monthKey: MONTH_KEY, subscriptionId: id, name: `Subscription ${id}`, amountCents };
}

function budget(id: number, plannedAmountCents: number): MonthBudget {
  return { id, monthKey: MONTH_KEY, budgetId: id, plannedAmountCents };
}

function plan(overrides: Partial<Parameters<typeof planMonth>[0]> = {}) {
  return planMonth({
    monthKey: MONTH_KEY,
    allowanceCents: 200000,
    drawCents: 0,
    fixedExpenses: [],
    subscriptions: [],
    budgets: [],
    ...overrides,
  });
}

describe('planMonth', () => {
  it('reports an empty month with nothing committed and nothing planned', () => {
    const result = plan();
    expect(result.availableCents).toBe(200000);
    expect(result.committedCents).toBe(0);
    expect(result.budgetPlannedCents).toBe(0);
    expect(result.remainingCents).toBe(200000);
    expect(result.overPlannedCents).toBe(0);
  });

  it('deducts expected fixed expenses and subscriptions before the plan', () => {
    const result = plan({
      fixedExpenses: [fixedExpense(1, 60000), fixedExpense(2, 40000)],
      subscriptions: [subscription(1, 10000)],
      budgets: [budget(1, 50000)],
    });
    expect(result.committedCents).toBe(110000);
    expect(result.distributableCents).toBe(90000);
    expect(result.budgetPlannedCents).toBe(50000);
    expect(result.remainingCents).toBe(40000);
  });

  it('distributes the allowance of an empty month across nothing yet', () => {
    const result = plan();
    expect(result.distributableCents).toBe(200000);
  });

  it('raises what the month can spend by the planned draw', () => {
    const withoutDraw = plan({ fixedExpenses: [fixedExpense(1, 60000)] });
    const withDraw = plan({ fixedExpenses: [fixedExpense(1, 60000)], drawCents: 25000 });
    expect(withDraw.availableCents).toBe(withoutDraw.availableCents + 25000);
    expect(withDraw.remainingCents).toBe(withoutDraw.remainingCents + 25000);
  });

  it('keeps the planned draw out of the stored allowance', () => {
    const result = plan({ drawCents: 25000 });
    expect(result.allowanceCents).toBe(200000);
    expect(result.drawCents).toBe(25000);
  });

  it('reports by how much the plan exceeds what the month can afford', () => {
    const result = plan({
      fixedExpenses: [fixedExpense(1, 100000)],
      budgets: [budget(1, 150000)],
    });
    expect(result.remainingCents).toBe(-50000);
    expect(result.overPlannedCents).toBe(50000);
  });

  it('never reports a negative overspend while the plan fits exactly', () => {
    const result = plan({ budgets: [budget(1, 200000)] });
    expect(result.remainingCents).toBe(0);
    expect(result.overPlannedCents).toBe(0);
  });

  it('lets a brand new user plan with no allowance, expenses or budgets', () => {
    const result = plan({ allowanceCents: 0 });
    expect(result.availableCents).toBe(0);
    expect(result.remainingCents).toBe(0);
    expect(result.overPlannedCents).toBe(0);
  });

  it('counts a budget planned from the reserve draw only', () => {
    const result = plan({ allowanceCents: 0, drawCents: 30000, budgets: [budget(1, 30000)] });
    expect(result.remainingCents).toBe(0);
    expect(result.overPlannedCents).toBe(0);
  });

  it('holds a negative draw back from the plan, so it stays in the reserve', () => {
    const withoutSaving = plan({ fixedExpenses: [fixedExpense(1, 60000)] });
    const saving = plan({ fixedExpenses: [fixedExpense(1, 60000)], drawCents: -50000 });
    expect(saving.availableCents).toBe(withoutSaving.availableCents - 50000);
    expect(saving.distributableCents).toBe(withoutSaving.distributableCents - 50000);
    expect(saving.remainingCents).toBe(withoutSaving.remainingCents - 50000);
    expect(saving.overPlannedCents).toBe(0);
  });

  it('reports the negative draw as drawn, so the sign stays readable', () => {
    expect(plan({ drawCents: -50000 }).drawCents).toBe(-50000);
  });

  it('lets a plan spend the money the user is not setting aside', () => {
    const withoutSaving = plan({ fixedExpenses: [fixedExpense(1, 60000)], budgets: [budget(1, 150000)] });
    expect(withoutSaving.overPlannedCents).toBe(10000);
    const withSaving = plan({
      fixedExpenses: [fixedExpense(1, 60000)],
      drawCents: -50000,
      budgets: [budget(1, 90000)],
    });
    expect(withSaving.remainingCents).toBe(0);
    expect(withSaving.overPlannedCents).toBe(0);
  });
});

describe('clampDrawCents', () => {
  it('caps a draw at what the reserve holds', () => {
    expect(clampDrawCents(30000, 20000)).toBe(20000);
  });

  it('keeps a draw the reserve can cover untouched', () => {
    expect(clampDrawCents(15000, 20000)).toBe(15000);
  });

  it('allows drawing exactly the whole reserve', () => {
    expect(clampDrawCents(20000, 20000)).toBe(20000);
  });

  it('leaves a negative draw alone, however large, because it is money coming in', () => {
    expect(clampDrawCents(-50000, 20000)).toBe(-50000);
    expect(clampDrawCents(-999999, 0)).toBe(-999999);
  });

  it('cannot turn a saving into a draw when the reserve is empty', () => {
    expect(clampDrawCents(5000, 0)).toBe(0);
  });
});

describe('budgetHeadroomCents', () => {
  const planWithTwoBudgets = plan({
    fixedExpenses: [fixedExpense(1, 60000)],
    subscriptions: [subscription(1, 10000)],
    budgets: [budget(1, 40000), budget(2, 30000)],
  });

  it('leaves the rest of the month available to a single budget', () => {
    expect(budgetHeadroomCents(planWithTwoBudgets, [
      { id: 1, amountCents: 40000 },
      { id: 2, amountCents: 30000 },
    ], 1)).toBe(100000);
  });

  it('counts the other budget as committed when planning this one', () => {
    expect(budgetHeadroomCents(planWithTwoBudgets, [
      { id: 1, amountCents: 40000 },
      { id: 2, amountCents: 30000 },
    ], 2)).toBe(90000);
  });

  it('includes the planned draw in the headroom', () => {
    const withDraw = plan({
      drawCents: 15000,
      fixedExpenses: [fixedExpense(1, 60000)],
      budgets: [budget(1, 40000)],
    });
    expect(budgetHeadroomCents(withDraw, [{ id: 1, amountCents: 40000 }], 1)).toBe(155000);
  });

  it('keeps a negative draw out of the headroom for the budgets', () => {
    const saving = plan({
      drawCents: -50000,
      fixedExpenses: [fixedExpense(1, 60000)],
      budgets: [budget(1, 40000)],
    });
    expect(budgetHeadroomCents(saving, [{ id: 1, amountCents: 40000 }], 1)).toBe(90000);
  });

  it('caps a budget below the headroom once the budget itself is over-planned', () => {
    const overPlanned = plan({
      fixedExpenses: [fixedExpense(1, 100000)],
      budgets: [budget(1, 150000)],
    });
    expect(overPlanned.overPlannedCents).toBe(50000);
    expect(budgetHeadroomCents(overPlanned, [{ id: 1, amountCents: 150000 }], 1)).toBe(100000);
  });
});

describe('toMonthBudgets', () => {
  it('turns the draft plan into the month budget rows the forecast reads', () => {
    const rows = toMonthBudgets(MONTH_KEY, [
      { budgetId: 7, plannedAmountCents: 12000 },
      { budgetId: 9, plannedAmountCents: 8000 },
    ]);
    expect(rows).toEqual([
      { id: 0, monthKey: MONTH_KEY, budgetId: 7, plannedAmountCents: 12000 },
      { id: 1, monthKey: MONTH_KEY, budgetId: 9, plannedAmountCents: 8000 },
    ]);
  });
});

describe('diffMonthPlan', () => {
  it('reports only the budgets whose amount moved, with both sides of the move', () => {
    const diff = diffMonthPlan(
      [
        { budgetId: 1, plannedAmountCents: 20000 },
        { budgetId: 2, plannedAmountCents: 10000 },
      ],
      { 1: 35000, 2: 10000 },
      0,
      0
    );
    expect(diff.budgetChanges).toEqual([
      { budgetId: 1, previousAmountCents: 20000, newAmountCents: 35000 },
    ]);
    expect(diff.drawChanged).toBe(false);
    expect(diff.unchanged).toBe(false);
  });

  it('reports a cut as well as a raise', () => {
    const diff = diffMonthPlan([{ budgetId: 3, plannedAmountCents: 30000 }], { 3: 12000 }, 0, 0);
    expect(diff.budgetChanges).toEqual([
      { budgetId: 3, previousAmountCents: 30000, newAmountCents: 12000 },
    ]);
  });

  it('calls a plan that stands where it is unchanged', () => {
    const diff = diffMonthPlan(
      [{ budgetId: 1, plannedAmountCents: 20000 }],
      { 1: 20000 },
      25000,
      25000
    );
    expect(diff.unchanged).toBe(true);
    expect(diff.budgetChanges).toEqual([]);
  });

  it('reports a change to the draw on its own', () => {
    const diff = diffMonthPlan([], {}, 0, 40000);
    expect(diff.drawChanged).toBe(true);
    expect(diff.unchanged).toBe(false);
    expect(diff.previousDrawCents).toBe(0);
    expect(diff.nextDrawCents).toBe(40000);
  });

  it('counts a draw cut back as a change, not as nothing happening', () => {
    const diff = diffMonthPlan([], {}, 40000, 0);
    expect(diff.drawChanged).toBe(true);
    expect(diff.unchanged).toBe(false);
  });
});

describe('fundedBudgetIdForDraw', () => {
  it('names the budget the extra draw was handed to when the amounts line up', () => {
    const diff = diffMonthPlan(
      [{ budgetId: 1, plannedAmountCents: 20000 }],
      { 1: 70000 },
      0,
      50000
    );
    expect(fundedBudgetIdForDraw(diff)).toBe(1);
  });

  it('leaves the draw unclaimed when no budget absorbed exactly the difference', () => {
    const diff = diffMonthPlan(
      [{ budgetId: 1, plannedAmountCents: 20000 }],
      { 1: 30000 },
      0,
      50000
    );
    expect(fundedBudgetIdForDraw(diff)).toBeNull();
  });

  it('leaves a draw that was cut unclaimed: no money was handed to anyone', () => {
    const diff = diffMonthPlan([], {}, 50000, 0);
    expect(fundedBudgetIdForDraw(diff)).toBeNull();
  });

  it('leaves an unchanged draw unclaimed', () => {
    const diff = diffMonthPlan([], {}, 50000, 50000);
    expect(fundedBudgetIdForDraw(diff)).toBeNull();
  });
});
