import {
  remainingAllowance,
  remainingForBudget,
  reserveAdjustmentCents,
  spendingDifference,
  unplannedAllowance,
} from '../../src/services/allowance-service';

describe('remainingAllowance', () => {
  it('is positive when spending is below the allowance', () => {
    expect(remainingAllowance(50000, 30000)).toBe(20000);
  });

  it('is zero when spending equals the allowance', () => {
    expect(remainingAllowance(50000, 50000)).toBe(0);
  });

  it('is negative when spending exceeds the allowance', () => {
    expect(remainingAllowance(50000, 60000)).toBe(-10000);
  });
});

describe('spendingDifference', () => {
  it('reports positive when actual spending exceeds planned spending', () => {
    expect(spendingDifference(40000, 30000)).toBe(10000);
  });

  it('reports negative when actual spending is below the plan', () => {
    expect(spendingDifference(20000, 30000)).toBe(-10000);
  });
});

describe('reserveAdjustmentCents', () => {
  it('goes negative when spending exceeds the allowance', () => {
    const result = reserveAdjustmentCents(60000, 50000);
    expect(result.adjustmentCents).toBe(-10000);
    expect(result.overspent).toBe(true);
  });

  it('is positive when spending is below the allowance', () => {
    const result = reserveAdjustmentCents(35000, 50000);
    expect(result.adjustmentCents).toBe(15000);
    expect(result.overspent).toBe(false);
  });

  it('produces no adjustment when spending equals the allowance', () => {
    const result = reserveAdjustmentCents(50000, 50000);
    expect(result.adjustmentCents).toBe(0);
    expect(result.overspent).toBe(false);
  });

  it('neutralises the adjustment when income covers the overspend', () => {
    const result = reserveAdjustmentCents(60000, 50000, 10000);
    expect(result.adjustmentCents).toBe(0);
    expect(result.overspent).toBe(false);
  });

  it('keeps income in the reserve when it exceeds the overspend', () => {
    const result = reserveAdjustmentCents(55000, 50000, 20000);
    expect(result.adjustmentCents).toBe(15000);
    expect(result.overspent).toBe(false);
  });

  it('stays unchanged when no income is provided', () => {
    expect(reserveAdjustmentCents(60000, 50000).adjustmentCents).toBe(-10000);
  });
});

describe('unplannedAllowance', () => {
  it('subtracts committed spending from the allowance', () => {
    expect(unplannedAllowance(50000, 15000)).toBe(35000);
  });
});

describe('remainingForBudget', () => {
  const budgets = [
    { id: 1, amountCents: 20000 },
    { id: 2, amountCents: 15000 },
    { id: 3, amountCents: 5000 },
  ];

  it('subtracts expected fixed expenses and the other budgets from the allowance', () => {
    const result = remainingForBudget({
      allowanceCents: 100000,
      expectedFixedExpensesCents: 30000,
      budgets,
      excludeBudgetId: 1,
    });
    expect(result).toBe(50000);
  });

  it('ignores one-off income (only the allowance is the base)', () => {
    const result = remainingForBudget({
      allowanceCents: 40000,
      expectedFixedExpensesCents: 10000,
      budgets: [{ id: 1, amountCents: 5000 }],
      excludeBudgetId: 1,
    });
    expect(result).toBe(30000);
  });

  it('deducts all other budgets when no budget is excluded', () => {
    const result = remainingForBudget({
      allowanceCents: 100000,
      expectedFixedExpensesCents: 0,
      budgets,
    });
    expect(result).toBe(60000);
  });

  it('deducts nothing for budgets when the list is empty', () => {
    const result = remainingForBudget({
      allowanceCents: 100000,
      expectedFixedExpensesCents: 30000,
      budgets: [],
      excludeBudgetId: 7,
    });
    expect(result).toBe(70000);
  });

  it('goes negative when committed plans exceed the allowance', () => {
    const result = remainingForBudget({
      allowanceCents: 30000,
      expectedFixedExpensesCents: 25000,
      budgets: [
        { id: 1, amountCents: 20000 },
        { id: 2, amountCents: 10000 },
      ],
      excludeBudgetId: 1,
    });
    expect(result).toBe(-5000);
  });

  it('excludes the budget being edited even when it is the only budget', () => {
    const result = remainingForBudget({
      allowanceCents: 50000,
      expectedFixedExpensesCents: 0,
      budgets: [{ id: 9, amountCents: 40000 }],
      excludeBudgetId: 9,
    });
    expect(result).toBe(50000);
  });
});