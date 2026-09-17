import type {
  Budget,
  FixedExpense,
  Income,
  Month,
  MonthBudget,
  MonthFixedExpense,
  ReserveTransfer,
  Transaction,
  YearlySubscription,
} from '../../src/models';
import {
  buildMonthlyReport,
  reportBudgets,
  reportFixedExpenses,
  subscriptionsChargedInMonth,
  type MonthlyReportInput,
} from '../../src/services/monthly-report-service';

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
  };
}

function subscription(partial: Partial<YearlySubscription>): YearlySubscription {
  return {
    id: 1,
    name: 'Streaming',
    yearlyAmountCents: 12000,
    monthlyAmountCents: 1000,
    startedMonth: '2025-01',
    billingMonth: '2026-01',
    deductMonthly: true,
    active: true,
    sortOrder: 0,
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

function transfer(direction: ReserveTransfer['direction'], amountCents: number): ReserveTransfer {
  return { id: 1, monthKey: MONTH_KEY, amountCents, direction, note: null };
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
    transfers: [],
    fixedExpenseDefinitions: {},
    budgetDefinitions: {},
    ...overrides,
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

describe('subscriptionsChargedInMonth', () => {
  it('includes only active subscriptions with a monthly deduction', () => {
    const report = subscriptionsChargedInMonth(
      [
        subscription({ id: 1, name: 'Active', monthlyAmountCents: 1000 }),
        subscription({ id: 2, name: 'Paused', active: false }),
        subscription({ id: 3, name: 'Yearly only', deductMonthly: false }),
      ],
      MONTH_KEY
    );
    expect(report).toEqual([{ name: 'Active', monthlyCents: 1000, renewalDueThisMonth: false }]);
  });

  it('flags subscriptions whose yearly renewal falls in the month', () => {
    const report = subscriptionsChargedInMonth(
      [subscription({ id: 1, name: 'Software', billingMonth: '2026-09' })],
      MONTH_KEY
    );
    expect(report[0].renewalDueThisMonth).toBe(true);
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
      { name: 'Groceries', plannedCents: 20000, spentCents: 16500, remainingCents: 3500 },
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
      name: 'Uncategorized',
      plannedCents: 0,
      spentCents: 9000,
      remainingCents: -9000,
    });
    expect(report[1].name).toBe('A');
  });

  it('omits the uncategorized entry when nothing is uncategorized', () => {
    const report = reportBudgets([monthBudget(1, 10000)], { 1: budget(1, 'A') }, [
      transaction(1, 3000),
    ]);
    expect(report.map((entry) => entry.name)).toEqual(['A']);
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
        subscriptions: [subscription({ id: 1, monthlyAmountCents: 500 })],
        income: [income(10000)],
        transfers: [transfer('to-reserve', 2000)],
        fixedExpenseDefinitions: { 1: fixedExpense(1, 'Rent') },
        budgetDefinitions: { 1: budget(1, 'Groceries') },
      })
    );
    expect(report.fixedTotalCents).toBe(30000);
    expect(report.subscriptionTotalCents).toBe(500);
    expect(report.budgetSpentTotalCents).toBe(8000);
    expect(report.spendingCents).toBe(38500);
    expect(report.adjustmentCents).toBe(21500);
    expect(report.transferNetCents).toBe(2000);
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
      name: 'Uncategorized',
      plannedCents: 0,
      spentCents: 3000,
      remainingCents: -3000,
    });
    expect(report.budgetSpentTotalCents).toBe(8000);
    expect(report.spendingCents).toBe(8000);
  });
});