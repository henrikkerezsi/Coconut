import type { Month, Transaction } from '../../src/models';
import {
  averageMonthlySpending,
  averageReserveAdjustment,
  highestMonthlySpending,
  monthlySeries,
  reserveDevelopment,
  spendingByCategory,
  totalMonthSpending,
} from '../../src/services/statistics-service';

function transaction(budgetId: number | null, amountCents: number, date = '2026-09-10'): Transaction {
  return {
    id: 1,
    monthKey: '2026-09',
    date,
    amountCents,
    budgetId,
    merchant: 'Test',
    note: null,
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

describe('averageReserveAdjustment', () => {
  it('returns null for an empty history', () => {
    expect(averageReserveAdjustment([])).toBeNull();
  });

  it('averages adjustments across months', () => {
    expect(averageReserveAdjustment([{ reserveAdjustmentCents: 1000 }, { reserveAdjustmentCents: -3000 }])).toBe(-1000);
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