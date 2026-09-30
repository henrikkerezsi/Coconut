import type {
  Budget,
  FixedExpense,
  Income,
  Month,
  MonthBudget,
  MonthFixedExpense,
  MonthPlanEvent,
  MonthSubscription,
  Transaction,
} from '../../src/models';
import {
  buildMonthlyReport,
  reportBudgets,
  reportFixedExpenses,
  reportSubscriptions,
  summarizeMonthPlan,
  type MonthlyReportInput,
} from '../../src/services/monthly-report-service';
import { forecastMonth } from '../../src/services/forecast-service';

const MONTH_KEY = '2026-09';

function fixedExpense(id: number, name: string): FixedExpense {
  return {
    id,
    name,
    expectedAmountCents: 0,
    kind: 'fixed',
    recurrence: 'monthly',
    estimationStrategy: 'manual',
    averageMonths: null,
    active: true,
    sortOrder: 0,
  };
}

function monthFixedExpense(instance: Partial<MonthFixedExpense>): MonthFixedExpense {
  return {
    id: 1,
    monthKey: MONTH_KEY,
    fixedExpenseId: 1,
    expectedAmountCents: 0,
    actualAmountCents: null,
    ...instance,
  };
}

function budget(id: number, name: string): Budget {
  return {
    id,
    name,
    defaultAmountCents: 0,
    active: true,
    sortOrder: 0,
    color: null,
  };
}

function monthBudget(budgetId: number, plannedAmountCents: number): MonthBudget {
  return { id: budgetId, monthKey: MONTH_KEY, budgetId, plannedAmountCents };
}

function transaction(budgetId: number | null, amountCents: number): Transaction {
  return {
    id: 1,
    monthKey: MONTH_KEY,
    date: '2026-09-10',
    amountCents,
    budgetId,
    merchant: 'Shop',
    note: null,
    attachmentName: null,
    attachmentMime: null,
    attachment: null,
    rating: null,
  };
}

function charge(partial: Partial<MonthSubscription> = {}): MonthSubscription {
  return {
    id: 1,
    monthKey: MONTH_KEY,
    subscriptionId: 1,
    name: 'Streaming',
    amountCents: 1000,
    ...partial,
  };
}

function income(amountCents: number): Income {
  return {
    id: 1,
    monthKey: MONTH_KEY,
    date: '2026-09-05',
    amountCents,
    description: 'Bonus',
    note: null,
  };
}

function month(partial: Partial<Month> = {}): Month {
  return {
    monthKey: MONTH_KEY,
    allowanceCents: 50000,
    startingReserveCents: 100000,
    endingReserveCents: null,
    isClosed: true,
    closedAt: '2026-10-01T00:00:00Z',
    ...partial,
  };
}

function input(overrides: Partial<MonthlyReportInput> = {}): MonthlyReportInput {
  return {
    month: month(),
    fixedExpenses: [],
    budgets: [],
    transactions: [],
    income: [],
    subscriptions: [],
    fixedExpenseDefinitions: {},
    budgetDefinitions: {},
    planEvents: [],
    ...overrides,
  };
}

function planEvent(event: Partial<MonthPlanEvent> & Pick<MonthPlanEvent, 'kind'>): MonthPlanEvent {
  return {
    id: 1,
    monthKey: MONTH_KEY,
    budgetId: null,
    previousAmountCents: 0,
    newAmountCents: 0,
    fundedBudgetId: null,
    createdAt: '2026-09-01T00:00:00.000Z',
    ...event,
  };
}

describe('reportFixedExpenses', () => {
  it('uses the actual amount once it is known', () => {
    const instances = [
      monthFixedExpense({ fixedExpenseId: 1, expectedAmountCents: 5000, actualAmountCents: 5400 }),
    ];
    const report = reportFixedExpenses(instances, { 1: fixedExpense(1, 'Rent') });
    expect(report).toEqual([
      { name: 'Rent', expectedCents: 5000, actualCents: 5400, chargedCents: 5400 },
    ]);
  });

  it('falls back to the expected amount when no actual is recorded', () => {
    const instances = [monthFixedExpense({ fixedExpenseId: 1, expectedAmountCents: 4500 })];
    const report = reportFixedExpenses(instances, { 1: fixedExpense(1, 'Insurance') });
    expect(report[0].chargedCents).toBe(4500);
    expect(report[0].actualCents).toBeNull();
  });

  it('uses a fallback name when the expense definition is missing', () => {
    const instances = [monthFixedExpense({ fixedExpenseId: 99, expectedAmountCents: 1000 })];
    const report = reportFixedExpenses(instances, {});
    expect(report[0].name).toBe('Expense #99');
  });
});

describe('reportSubscriptions', () => {
  it('reports the charges frozen into the month', () => {
    const report = reportSubscriptions([
      charge({ id: 1, name: 'Active', amountCents: 1000 }),
      charge({ id: 2, name: 'Paused', amountCents: 2500 }),
    ]);
    expect(report).toEqual([
      { name: 'Active', monthlyCents: 1000 },
      { name: 'Paused', monthlyCents: 2500 },
    ]);
  });

  it('edges: reports charges whose subscription no longer exists', () => {
    const report = reportSubscriptions([
      charge({ id: 1, name: 'Deleted', subscriptionId: null, amountCents: 500 }),
    ]);
    expect(report).toEqual([{ name: 'Deleted', monthlyCents: 500 }]);
  });

  it('reports nothing for a month without charges', () => {
    const report = reportSubscriptions([]);
    expect(report).toEqual([]);
  });
});

describe('reportBudgets', () => {
  it('returns planned, spent and remaining per budget', () => {
    const report = reportBudgets(
      [monthBudget(1, 20000)],
      { 1: budget(1, 'Groceries') },
      [transaction(1, 12000), transaction(1, 4500)]
    );
    expect(report).toEqual([
      {
        name: 'Groceries',
        startingCents: null,
        plannedCents: 20000,
        spentCents: 16500,
        remainingCents: 3500,
      },
    ]);
  });

  it('sorts budgets by amount spent descending', () => {
    const report = reportBudgets(
      [monthBudget(1, 20000), monthBudget(2, 30000)],
      { 1: budget(1, 'A'), 2: budget(2, 'B') },
      [transaction(1, 5000), transaction(2, 25000)]
    );
    expect(report.map((entry) => entry.name)).toEqual(['B', 'A']);
  });

  it('lists spending without a budget as an uncategorized entry', () => {
    const report = reportBudgets([monthBudget(1, 10000)], { 1: budget(1, 'A') }, [
      transaction(null, 9000),
    ]);
    expect(report).toContainEqual({
      name: 'No budget',
      startingCents: null,
      plannedCents: 0,
      spentCents: 9000,
      remainingCents: -9000,
    });
    expect(report[1].name).toBe('A');
  });

  it('omits the no-budget entry when nothing is unassigned', () => {
    const report = reportBudgets([monthBudget(1, 10000)], { 1: budget(1, 'A') }, [
      transaction(1, 3000),
    ]);
    expect(report.map((entry) => entry.name)).toEqual(['A']);
  });

  it('reports the opening amount of a budget the plan record opens', () => {
    const report = reportBudgets([monthBudget(1, 20000)], { 1: budget(1, 'Groceries') }, [], {
      startingByBudget: new Map([[1, 15000]]),
      initialDrawCents: null,
      endingDrawCents: null,
    });
    expect(report[0].startingCents).toBe(15000);
    expect(report[0].plannedCents).toBe(20000);
  });
});

describe('summarizeMonthPlan', () => {
  it('reads the opening amount of a budget from its initial event', () => {
    const summary = summarizeMonthPlan([
      planEvent({ kind: 'initial', budgetId: 1, newAmountCents: 25000 }),
    ]);
    expect(summary.startingByBudget.get(1)).toBe(25000);
  });

  it('keeps the first opening event when a budget is re-planned', () => {
    const summary = summarizeMonthPlan([
      planEvent({ id: 1, kind: 'initial', budgetId: 1, newAmountCents: 25000 }),
      planEvent({ id: 2, kind: 'budget', budgetId: 1, previousAmountCents: 25000, newAmountCents: 30000 }),
      planEvent({ id: 3, kind: 'budget', budgetId: 1, previousAmountCents: 30000, newAmountCents: 28000 }),
    ]);
    expect(summary.startingByBudget.get(1)).toBe(25000);
  });

  it('leaves a budget with no initial event out rather than guessing a start', () => {
    const summary = summarizeMonthPlan([
      planEvent({ id: 1, kind: 'budget', budgetId: 1, previousAmountCents: 10000, newAmountCents: 12000 }),
    ]);
    expect(summary.startingByBudget.has(1)).toBe(false);
  });

  it('reads the draw at both ends of the month', () => {
    const summary = summarizeMonthPlan([
      planEvent({ id: 1, kind: 'draw', newAmountCents: 20000 }),
      planEvent({ id: 2, kind: 'draw', previousAmountCents: 20000, newAmountCents: 35000 }),
    ]);
    expect(summary.initialDrawCents).toBe(20000);
    expect(summary.endingDrawCents).toBe(35000);
  });

  it('reports no draw at all for a month that never planned one', () => {
    const summary = summarizeMonthPlan([planEvent({ kind: 'initial', budgetId: 1, newAmountCents: 1000 })]);
    expect(summary.initialDrawCents).toBeNull();
    expect(summary.endingDrawCents).toBeNull();
  });

  it('ignores a funded budget, which is not a draw amount', () => {
    const summary = summarizeMonthPlan([
      planEvent({ kind: 'draw', newAmountCents: 20000, fundedBudgetId: 1 }),
    ]);
    expect(summary.endingDrawCents).toBe(20000);
    expect(summary.startingByBudget.size).toBe(0);
  });
});

describe('buildMonthlyReport', () => {
  it('sums spending and computes the reserve adjustment', () => {
    const report = buildMonthlyReport(
      input({
        month: month({ allowanceCents: 50000 }),
        fixedExpenses: [monthFixedExpense({ fixedExpenseId: 1, expectedAmountCents: 30000 })],
        budgets: [monthBudget(1, 15000)],
        transactions: [transaction(1, 8000)],
        subscriptions: [charge({ id: 1, amountCents: 500 })],
        income: [income(10000)],
        fixedExpenseDefinitions: { 1: fixedExpense(1, 'Rent') },
        budgetDefinitions: { 1: budget(1, 'Groceries') },
      })
    );
    expect(report.fixedTotalCents).toBe(30000);
    expect(report.subscriptionTotalCents).toBe(500);
    expect(report.budgetSpentTotalCents).toBe(8000);
    expect(report.spendingCents).toBe(38500);
    expect(report.adjustmentCents).toBe(21500);
  });

  it('reports a negative adjustment when spending exceeds available funds', () => {
    const report = buildMonthlyReport(
      input({
        fixedExpenses: [monthFixedExpense({ fixedExpenseId: 1, expectedAmountCents: 60000 })],
        fixedExpenseDefinitions: { 1: fixedExpense(1, 'Rent') },
      })
    );
    expect(report.adjustmentCents).toBe(-10000);
  });

  it('preserves the starting and ending reserve of the month', () => {
    const report = buildMonthlyReport(
      input({
        month: month({ startingReserveCents: 80000, endingReserveCents: 75000 }),
      })
    );
    expect(report.startingReserveCents).toBe(80000);
    expect(report.endingReserveCents).toBe(75000);
  });

  it('produces empty lists for an empty month', () => {
    const report = buildMonthlyReport(input());
    expect(report.fixedExpenses).toEqual([]);
    expect(report.subscriptions).toEqual([]);
    expect(report.budgets).toEqual([]);
    expect(report.spendingCents).toBe(0);
    expect(report.adjustmentCents).toBe(50000);
  });

  it('counts uncategorized transactions in spending and budget totals', () => {
    const report = buildMonthlyReport(
      input({
        budgets: [monthBudget(1, 10000)],
        transactions: [transaction(1, 5000), transaction(null, 3000)],
        budgetDefinitions: { 1: budget(1, 'Groceries') },
      })
    );
    expect(report.budgets).toContainEqual({
      name: 'No budget',
      startingCents: null,
      plannedCents: 0,
      spentCents: 3000,
      remainingCents: -3000,
    });
    expect(report.budgetSpentTotalCents).toBe(8000);
    expect(report.spendingCents).toBe(8000);
  });

  it('reports where each budget started and what it was adjusted to at closing', () => {
    const report = buildMonthlyReport(
      input({
        budgets: [monthBudget(1, 20000), monthBudget(2, 9000)],
        transactions: [transaction(1, 12000)],
        budgetDefinitions: { 1: budget(1, 'Groceries'), 2: budget(2, 'Transport') },
        planEvents: [
          planEvent({ id: 1, kind: 'initial', budgetId: 1, newAmountCents: 15000 }),
          planEvent({ id: 2, kind: 'initial', budgetId: 2, newAmountCents: 9000 }),
          planEvent({
            id: 3,
            kind: 'budget',
            budgetId: 1,
            previousAmountCents: 15000,
            newAmountCents: 20000,
          }),
        ],
      })
    );
    const groceries = report.budgets.find((entry) => entry.name === 'Groceries');
    const transport = report.budgets.find((entry) => entry.name === 'Transport');
    expect(groceries?.startingCents).toBe(15000);
    expect(groceries?.plannedCents).toBe(20000);
    expect(transport?.startingCents).toBe(9000);
    expect(transport?.plannedCents).toBe(9000);
  });

  it('leaves the starting amount unknown for a month with no plan record', () => {
    const report = buildMonthlyReport(
      input({
        budgets: [monthBudget(1, 20000)],
        budgetDefinitions: { 1: budget(1, 'Groceries') },
        planEvents: [],
      })
    );
    expect(report.budgets[0].startingCents).toBeNull();
    expect(report.budgets[0].plannedCents).toBe(20000);
    expect(report.initialDrawCents).toBeNull();
    expect(report.endingDrawCents).toBeNull();
  });

  it('carries the planned draw at both ends of the month into the report', () => {
    const report = buildMonthlyReport(
      input({
        planEvents: [
          planEvent({ id: 1, kind: 'draw', newAmountCents: 20000 }),
          planEvent({ id: 2, kind: 'draw', previousAmountCents: 20000, newAmountCents: 35000 }),
        ],
      })
    );
    expect(report.initialDrawCents).toBe(20000);
    expect(report.endingDrawCents).toBe(35000);
  });

  it('spends the same as the month forecast for the same data', () => {
    const monthData = {
      month: month({ allowanceCents: 200000 }),
      fixedExpenses: [
        monthFixedExpense({ fixedExpenseId: 1, expectedAmountCents: 50000, actualAmountCents: 52000 }),
        monthFixedExpense({ fixedExpenseId: 2, expectedAmountCents: 10000 }),
      ],
      budgets: [monthBudget(1, 15000)],
      transactions: [transaction(1, 3000), transaction(null, 2500)],
      subscriptions: [charge({ id: 1, amountCents: 3500 })],
      income: [income(20000)],
      fixedExpenseDefinitions: { 1: fixedExpense(1, 'Rent'), 2: fixedExpense(2, 'Power') },
      budgetDefinitions: { 1: budget(1, 'Groceries') },
    };
    const report = buildMonthlyReport(input(monthData));
    const forecast = forecastMonth({
      month: monthData.month,
      fixedExpenses: monthData.fixedExpenses,
      budgets: monthData.budgets,
      transactions: monthData.transactions,
      subscriptions: monthData.subscriptions,
      income: monthData.income,
    });
    expect(report.spendingCents).toBe(forecast.actualSpendingCents);
    expect(report.adjustmentCents).toBe(220000 - forecast.actualSpendingCents);
  });
});
