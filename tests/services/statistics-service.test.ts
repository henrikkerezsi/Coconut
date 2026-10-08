import type { Month, Transaction, TransactionRating } from '../../src/models';
import {
  averageBudgetPerformance,
  averageMonthlySpending,
  averageReserveAdjustment,
  highestMonthlySpending,
  medianMonthlySpending,
  monthlySeries,
  ratingSharesForMonth,
  reserveDevelopment,
  spendingByCategory,
  totalMonthSpending,
} from '../../src/services/statistics-service';

function transaction(
  budgetId: number | null,
  amountCents: number,
  date = '2026-09-10',
  rating: TransactionRating | null = null
): Transaction {
  return {
    id: 1,
    monthKey: '2026-09',
    date,
    amountCents,
    budgetId,
    merchant: 'Test',
    note: null,
    attachmentName: null,
    attachmentMime: null,
    attachment: null,
    rating,
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

describe('totalMonthSpending', () => {
  it('adds fixed and discretionary spending', () => {
    expect(totalMonthSpending(30000, 15000)).toBe(45000);
  });
});

describe('averageMonthlySpending', () => {
  it('returns null for an empty history', () => {
    expect(averageMonthlySpending([])).toBeNull();
  });

  it('averages spending across months', () => {
    expect(averageMonthlySpending([{ spendingCents: 10000 }, { spendingCents: 20000 }])).toBe(15000);
  });

  it('rounds to whole cents', () => {
    expect(averageMonthlySpending([{ spendingCents: 101 }, { spendingCents: 102 }])).toBe(102);
  });
});

describe('highestMonthlySpending', () => {
  it('returns null for an empty history', () => {
    expect(highestMonthlySpending([])).toBeNull();
  });

  it('returns the maximum single-month spending', () => {
    expect(highestMonthlySpending([{ spendingCents: 10000 }, { spendingCents: 25000 }])).toBe(25000);
  });
});

describe('medianMonthlySpending', () => {
  it('returns null for an empty history', () => {
    expect(medianMonthlySpending([])).toBeNull();
  });

  it('returns the middle value for an odd number of months', () => {
    const records = [
      { spendingCents: 50000 },
      { spendingCents: 30000 },
      { spendingCents: 80000 },
    ];
    expect(medianMonthlySpending(records)).toBe(50000);
  });

  it('averages the two middle values for an even number of months', () => {
    const records = [
      { spendingCents: 40000 },
      { spendingCents: 20000 },
      { spendingCents: 60000 },
      { spendingCents: 30000 },
    ];
    expect(medianMonthlySpending(records)).toBe(35000);
  });

  it('rounds to whole cents', () => {
    const records = [
      { spendingCents: 101 },
      { spendingCents: 102 },
      { spendingCents: 101 },
      { spendingCents: 104 },
    ];
    expect(medianMonthlySpending(records)).toBe(102);
  });
});

describe('averageReserveAdjustment', () => {
  it('returns null for an empty history', () => {
    expect(averageReserveAdjustment([])).toBeNull();
  });

  it('averages adjustments across months', () => {
    expect(averageReserveAdjustment([{ reserveAdjustmentCents: 1000 }, { reserveAdjustmentCents: -3000 }])).toBe(-1000);
  });
});

describe('averageBudgetPerformance', () => {
  it('returns null for an empty history', () => {
    expect(averageBudgetPerformance([])).toBeNull();
  });

  it('returns null when no month had a plan', () => {
    const months = [
      { plannedCents: 0, spentCents: 5000 },
      { plannedCents: 0, spentCents: 0 },
    ];
    expect(averageBudgetPerformance(months)).toBeNull();
  });

  it('skips months without a plan even when money was spent', () => {
    const months = [
      { plannedCents: 10000, spentCents: 11000 },
      { plannedCents: 0, spentCents: 5000 },
      { plannedCents: 10000, spentCents: 9000 },
    ];
    expect(averageBudgetPerformance(months)).toBe(100);
  });

  it('counts an allocated but unused month as 0%', () => {
    const months = [
      { plannedCents: 10000, spentCents: 0 },
      { plannedCents: 10000, spentCents: 9000 },
    ];
    expect(averageBudgetPerformance(months)).toBe(45);
  });

  it('averages per-month ratios, not summed totals', () => {
    const months = [
      { plannedCents: 10000, spentCents: 11000 },
      { plannedCents: 20000, spentCents: 18000 },
    ];
    expect(averageBudgetPerformance(months)).toBe(100);
  });

  it('averages at 100% when one month ran 110% and another 90%', () => {
    const months = [
      { plannedCents: 10000, spentCents: 11000 },
      { plannedCents: 10000, spentCents: 9000 },
    ];
    expect(averageBudgetPerformance(months)).toBe(100);
  });

  it('rounds to a whole percentage', () => {
    const months = [
      { plannedCents: 30000, spentCents: 10000 },
      { plannedCents: 30000, spentCents: 10000 },
    ];
    expect(averageBudgetPerformance(months)).toBe(33);
  });

  it('reports a single month unchanged', () => {
    const months = [{ plannedCents: 25000, spentCents: 30000 }];
    expect(averageBudgetPerformance(months)).toBe(120);
  });
});

describe('spendingByCategory', () => {
  it('groups spending per budget', () => {
    const result = spendingByCategory([
      transaction(1, 500),
      transaction(2, 300),
      transaction(1, 200),
      transaction(null, 999),
    ]);
    expect(result.get(1)).toBe(700);
    expect(result.get(2)).toBe(300);
    expect(result.has(null as unknown as number)).toBe(false);
    expect(result.size).toBe(2);
  });
});

describe('ratingSharesForMonth', () => {
  it('returns null for an empty month', () => {
    expect(ratingSharesForMonth([])).toBeNull();
  });

  it('counts an unrated transaction as neutral', () => {
    expect(ratingSharesForMonth([transaction(1, 100), transaction(1, 100)])).toEqual({
      regret: 0,
      neutral: 100,
      good: 0,
    });
  });

  it('splits months of a single rating class', () => {
    expect(
      ratingSharesForMonth([
        transaction(1, 100, '2026-09-10', 'regret'),
        transaction(1, 100, '2026-09-11', 'good'),
      ])
    ).toEqual({ regret: 50, neutral: 0, good: 50 });
  });

  it('counts explicit neutral alongside the other classes', () => {
    expect(
      ratingSharesForMonth([
        transaction(1, 100, '2026-09-10', 'regret'),
        transaction(1, 100, '2026-09-11', 'neutral'),
        transaction(1, 100, '2026-09-12', 'good'),
        transaction(1, 100, '2026-09-13', 'good'),
      ])
    ).toEqual({ regret: 25, neutral: 25, good: 50 });
  });

  it('rounds a third share to a whole percentage', () => {
    expect(
      ratingSharesForMonth([
        transaction(1, 100, '2026-09-10', 'regret'),
        transaction(1, 100, '2026-09-11'),
        transaction(1, 100, '2026-09-12', 'good'),
      ])
    ).toEqual({ regret: 33, neutral: 33, good: 33 });
  });
});

describe('monthlySeries', () => {
  it('sorts months ascending by key', () => {
    const records = [
      {
        monthKey: '2026-03',
        allowanceCents: 50000,
        spendingCents: 40000,
        reserveAdjustmentCents: -10000,
        endingReserveCents: 90000,
      },
      {
        monthKey: '2026-01',
        allowanceCents: 50000,
        spendingCents: 60000,
        reserveAdjustmentCents: 10000,
        endingReserveCents: 110000,
      },
    ];
    expect(monthlySeries(records).map((record) => record.monthKey)).toEqual(['2026-01', '2026-03']);
  });
});

describe('reserveDevelopment', () => {
  it('sorts months and projects ending reserves', () => {
    const months: Month[] = [
      month({ monthKey: '2026-08', endingReserveCents: 95000 }),
      month({ monthKey: '2026-09', endingReserveCents: null }),
    ];
    expect(reserveDevelopment(months)).toEqual([
      { monthKey: '2026-08', reserveCents: 95000 },
      { monthKey: '2026-09', reserveCents: null },
    ]);
  });
});