import type {
  Income,
  Month,
  MonthBudget,
  MonthFixedExpense,
  MonthSubscription,
  Transaction,
} from '../../src/models';
import {
  budgetStatus,
  fixedExpenseAmount,
  forecastMonth,
  incomeTotal,
  sumFixedExpenses,
  transactionTotal,
} from '../../src/services/forecast-service';

function instance(
  overrides: Partial<MonthFixedExpense> = {}
): MonthFixedExpense {
  return {
    id: 1,
    monthKey: '2026-09',
    fixedExpenseId: 1,
    expectedAmountCents: 10000,
    actualAmountCents: null,
    ...overrides,
  };
}

function month(overrides: Partial<Month> = {}): Month {
  return {
    monthKey: '2026-09',
    allowanceCents: 50000,
    startingReserveCents: 100000,
    endingReserveCents: null,
    isClosed: false,
    closedAt: null,
    ...overrides,
  };
}

function transaction(amountCents: number, budgetId: number | null = 1): Transaction {
  return {
    id: 1,
    monthKey: '2026-09',
    date: '2026-09-10',
    amountCents,
    budgetId,
    merchant: 'Test',
    note: null,
    attachmentName: null,
    attachmentMime: null,
    attachment: null,
  };
}

function income(amountCents: number): Income {
  return {
    id: 1,
    monthKey: '2026-09',
    date: '2026-09-03',
    amountCents,
    description: 'Bonus',
    note: null,
  };
}

function charge(overrides: Partial<MonthSubscription> = {}): MonthSubscription {
  return {
    id: 1,
    monthKey: '2026-09',
    subscriptionId: 1,
    name: 'Streaming',
    amountCents: 1000,
    ...overrides,
  };
}

describe('fixedExpenseAmount', () => {
  it('uses the actual amount once it is known', () => {
    expect(fixedExpenseAmount(instance({ actualAmountCents: 12345 }))).toBe(12345);
  });

  it('defaults to the expected amount while actual is unknown', () => {
    expect(fixedExpenseAmount(instance({ actualAmountCents: null }))).toBe(10000);
  });

  it('accepts a zero actual as a real amount', () => {
    expect(fixedExpenseAmount(instance({ actualAmountCents: 0 }))).toBe(0);
  });
});

describe('sumFixedExpenses', () => {
  it('totals expected and charged amounts separately', () => {
    const result = sumFixedExpenses([
      instance({ expectedAmountCents: 10000, actualAmountCents: null }),
      instance({ expectedAmountCents: 20000, actualAmountCents: 25000 }),
    ]);
    expect(result.expectedTotalCents).toBe(30000);
    expect(result.actualTotalCents).toBe(25000);
    expect(result.chargedTotalCents).toBe(35000);
  });
});

describe('transactionTotal', () => {
  it('sums transaction amounts', () => {
    expect(transactionTotal([transaction(100), transaction(250)])).toBe(350);
  });

  it('returns zero for an empty list', () => {
    expect(transactionTotal([])).toBe(0);
  });
});

describe('incomeTotal', () => {
  it('sums income amounts', () => {
    expect(incomeTotal([income(1000), income(2500)])).toBe(3500);
  });

  it('returns zero for an empty list', () => {
    expect(incomeTotal([])).toBe(0);
  });
});

describe('budgetStatus', () => {
  it('reports remaining and difference', () => {
    const status = budgetStatus(30000, 18000);
    expect(status.remainingCents).toBe(12000);
    expect(status.differenceCents).toBe(-12000);
  });

  it('reports overage as a positive difference', () => {
    const status = budgetStatus(30000, 35000);
    expect(status.remainingCents).toBe(-5000);
    expect(status.differenceCents).toBe(5000);
  });
});

describe('forecastMonth', () => {
  const fixed: MonthFixedExpense[] = [
    instance({ expectedAmountCents: 20000, actualAmountCents: 22000 }),
    instance({ expectedAmountCents: 10000, actualAmountCents: null }),
  ];
  const budgets: MonthBudget[] = [
    { id: 1, monthKey: '2026-09', budgetId: 1, plannedAmountCents: 15000 },
    { id: 2, monthKey: '2026-09', budgetId: 2, plannedAmountCents: 5000 },
  ];
  const transactions: Transaction[] = [transaction(3000), transaction(2000)];

  it('splits planned spending from actual spending', () => {
    const forecast = forecastMonth({ month: month(), fixedExpenses: fixed, budgets, transactions });
    expect(forecast.actualSpendingCents).toBe(37000);
    expect(forecast.plannedSpendingCents).toBe(50000);
    expect(forecast.fixedExpectedTotalCents).toBe(30000);
    expect(forecast.fixedChargedTotalCents).toBe(32000);
    expect(forecast.discretionarySpendingCents).toBe(5000);
    expect(forecast.budgetPlannedTotalCents).toBe(20000);
  });

  it('computes remaining allowance and expected adjustment', () => {
    const forecast = forecastMonth({ month: month(), fixedExpenses: fixed, budgets, transactions });
    expect(forecast.remainingAllowanceCents).toBe(13000);
    expect(forecast.expectedAdjustmentCents).toBe(50000 - 37000);
  });

  it('reports what is left of the plan', () => {
    const forecast = forecastMonth({ month: month(), fixedExpenses: fixed, budgets, transactions });
    expect(forecast.remainingVsPlanCents).toBe(50000 - 37000);
  });

  it('reports a negative remainder once spending passes the plan', () => {
    const forecast = forecastMonth({
      month: month(),
      fixedExpenses: fixed,
      budgets,
      transactions: [transaction(30000), transaction(20000)],
    });
    expect(forecast.remainingVsPlanCents).toBe(50000 - 82000);
  });

  it('keeps subscriptions neutral against the plan', () => {
    const forecast = forecastMonth({
      month: month(),
      subscriptions: [charge({ amountCents: 3500 })],
      fixedExpenses: fixed,
      budgets,
      transactions,
    });
    expect(forecast.remainingVsPlanCents).toBe(50000 - 37000);
  });

  it('reports the planned reserve draw against the allowance alone', () => {
    const forecast = forecastMonth({ month: month(), fixedExpenses: fixed, budgets, transactions });
    expect(forecast.allowanceVsPlanCents).toBe(50000 - 50000);
  });

  it('ignores one-off income in the planned reserve draw', () => {
    const forecast = forecastMonth({
      month: month(),
      income: [income(20000)],
      fixedExpenses: fixed,
      budgets,
      transactions,
    });
    expect(forecast.allowanceVsPlanCents).toBe(50000 - 50000);
    expect(forecast.remainingAllowanceCents).toBe(70000 - 37000);
  });

  it('handles a month with no data', () => {
    const forecast = forecastMonth({
      month: month(),
      fixedExpenses: [],
      budgets: [],
      transactions: [],
    });
    expect(forecast.actualSpendingCents).toBe(0);
    expect(forecast.plannedSpendingCents).toBe(0);
    expect(forecast.remainingAllowanceCents).toBe(50000);
  });

  it('adds one-off income to what is available for the month', () => {
    const forecast = forecastMonth({
      month: month(),
      income: [income(10000), income(5000)],
      fixedExpenses: fixed,
      budgets,
      transactions,
    });
    expect(forecast.incomeTotalCents).toBe(15000);
    expect(forecast.availableCents).toBe(65000);
    expect(forecast.remainingAllowanceCents).toBe(65000 - 37000);
    expect(forecast.expectedAdjustmentCents).toBe(65000 - 37000);
  });

  it('treats unspent income as savings at month end', () => {
    const forecast = forecastMonth({
      month: month(),
      income: [income(20000)],
      fixedExpenses: [],
      budgets: [],
      transactions: [],
    });
    expect(forecast.availableCents).toBe(70000);
    expect(forecast.remainingAllowanceCents).toBe(70000);
    expect(forecast.expectedAdjustmentCents).toBe(70000);
  });

  it('deducts active yearly subscriptions from the month', () => {
    const forecast = forecastMonth({
      month: month(),
      subscriptions: [charge({ amountCents: 1000 }), charge({ id: 2, amountCents: 2500 })],
      fixedExpenses: fixed,
      budgets,
      transactions,
    });
    expect(forecast.subscriptionTotalCents).toBe(3500);
    expect(forecast.plannedSpendingCents).toBe(50000 + 3500);
    expect(forecast.actualSpendingCents).toBe(37000 + 3500);
    expect(forecast.remainingAllowanceCents).toBe(50000 - 37000 - 3500);
  });

  it('uses only the subscription charges frozen into the month', () => {
    const forecast = forecastMonth({
      month: month(),
      subscriptions: [charge({ amountCents: 1000 })],
      fixedExpenses: [],
      budgets: [],
      transactions: [],
    });
    expect(forecast.subscriptionTotalCents).toBe(1000);
    expect(forecast.actualSpendingCents).toBe(1000);
    expect(forecast.plannedSpendingCents).toBe(1000);
  });

  it('has no subscription spending when the month holds no charges', () => {
    const forecast = forecastMonth({
      month: month(),
      fixedExpenses: [],
      budgets: [],
      transactions: [],
    });
    expect(forecast.subscriptionTotalCents).toBe(0);
    expect(forecast.actualSpendingCents).toBe(0);
  });
});

describe('actual spending covers everything spent', () => {
  const everything = {
    month: month({ allowanceCents: 200000 }),
    income: [income(20000)],
    subscriptions: [
      charge({ id: 1, name: 'Streaming', amountCents: 1000 }),
      charge({ id: 2, name: 'Gym', amountCents: 2500 }),
    ],
    fixedExpenses: [
      instance({ id: 1, fixedExpenseId: 1, expectedAmountCents: 50000, actualAmountCents: 52000 }),
      instance({ id: 2, fixedExpenseId: 2, expectedAmountCents: 10000, actualAmountCents: null }),
    ],
    budgets: [{ id: 1, monthKey: '2026-09', budgetId: 1, plannedAmountCents: 15000 }],
    transactions: [
      transaction(3000, 1),
      transaction(2500, null),
    ],
  };

  it('charges every fixed expense, using the actual amount when it is known', () => {
    const forecast = forecastMonth(everything);
    expect(forecast.fixedChargedTotalCents).toBe(62000);
  });

  it('counts transactions with and without a budget', () => {
    const forecast = forecastMonth(everything);
    expect(forecast.discretionarySpendingCents).toBe(5500);
  });

  it('counts every subscription that charges the month', () => {
    const forecast = forecastMonth(everything);
    expect(forecast.subscriptionTotalCents).toBe(3500);
  });

  it('sums fixed expenses, subscriptions and transactions into actual spending', () => {
    const forecast = forecastMonth(everything);
    expect(forecast.actualSpendingCents).toBe(62000 + 3500 + 5500);
  });

  it('derives available and remaining from the same totals', () => {
    const forecast = forecastMonth(everything);
    expect(forecast.availableCents).toBe(220000);
    expect(forecast.remainingAllowanceCents).toBe(220000 - 71000);
    expect(forecast.remainingVsPlanCents).toBe(78500 - 71000);
  });
});
