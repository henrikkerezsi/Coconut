import { estimateAmount, type ActualAmount } from '../../src/services/estimation-service';
import type { FixedExpense } from '../../src/models';

function expense(overrides: Partial<FixedExpense> = {}): FixedExpense {
  return {
    id: 1,
    name: 'Expense',
    expectedAmountCents: 10000,
    kind: 'variable',
    recurrence: 'monthly',
    estimationStrategy: 'manual',
    averageMonths: null,
    active: true,
    sortOrder: 0,
    ...overrides,
  };
}

const history: ActualAmount[] = [
  { monthKey: '2026-01', actualAmountCents: 10000 },
  { monthKey: '2026-02', actualAmountCents: 12000 },
  { monthKey: '2026-03', actualAmountCents: 14000 },
];

describe('estimateAmount', () => {
  it('returns the configured amount for genuinely fixed expenses', () => {
    const result = estimateAmount(expense({ kind: 'fixed' }), history);
    expect(result).toBe(10000);
  });

  it('returns the configured amount for the manual strategy regardless of history', () => {
    expect(estimateAmount(expense({ estimationStrategy: 'manual' }), history)).toBe(10000);
    expect(estimateAmount(expense({ estimationStrategy: 'manual' }), [])).toBe(10000);
  });

  it('uses the previous month actual for the last-month strategy', () => {
    const result = estimateAmount(expense({ estimationStrategy: 'last-month' }), history);
    expect(result).toBe(14000);
  });

  it('falls back to the configured amount when last-month history is missing', () => {
    const result = estimateAmount(expense({ estimationStrategy: 'last-month' }), []);
    expect(result).toBe(10000);
  });

  it('averages the most recent configured number of months', () => {
    const result = estimateAmount(
      expense({ estimationStrategy: 'average', averageMonths: 2 }),
      history
    );
    expect(result).toBe(13000);
  });

  it('averages the whole history when no window size is configured', () => {
    const result = estimateAmount(expense({ estimationStrategy: 'average' }), history);
    expect(result).toBe(12000);
  });

  it('rounds averages to the nearest cent', () => {
    const uneven: ActualAmount[] = [
      { monthKey: '2026-01', actualAmountCents: 101 },
      { monthKey: '2026-02', actualAmountCents: 102 },
      { monthKey: '2026-03', actualAmountCents: 102 },
    ];
    const result = estimateAmount(expense({ estimationStrategy: 'history-average' }), uneven);
    expect(result).toBe(102);
  });

  it('averages the entire history for the history-average strategy', () => {
    const result = estimateAmount(expense({ estimationStrategy: 'history-average' }), history);
    expect(result).toBe(12000);
  });

  it('only considers months older than the target month', () => {
    const result = estimateAmount(
      expense({ estimationStrategy: 'last-month' }),
      history,
      '2026-03'
    );
    expect(result).toBe(12000);
  });

  it('falls back to the configured amount when no months precede the target', () => {
    const result = estimateAmount(
      expense({ estimationStrategy: 'history-average' }),
      history,
      '2026-01'
    );
    expect(result).toBe(10000);
  });
});