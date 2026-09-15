import type { FixedExpense, MonthKey } from '../models';

export interface ActualAmount {
  monthKey: MonthKey;
  actualAmountCents: number;
}

export type EstimateSource = Pick<
  FixedExpense,
  'kind' | 'estimationStrategy' | 'expectedAmountCents' | 'averageMonths'
>;

function sum(amounts: ActualAmount[]): number {
  return amounts.reduce((total, amount) => total + amount.actualAmountCents, 0);
}

function averageCents(total: number, count: number): number {
  return Math.round(total / count);
}

/**
 * Estimates the expected amount for a variable fixed expense.
 *
 * Only actuals belonging to months strictly before `targetMonthKey` are considered,
 * so estimates are derived from historical data only. If no usable history exists,
 * the manually configured expected amount is used as a fallback.
 */
export function estimateAmount(
  expense: EstimateSource,
  actuals: ActualAmount[],
  targetMonthKey?: MonthKey
): number {
  if (expense.kind === 'fixed') {
    return expense.expectedAmountCents;
  }

  const relevant = actuals
    .filter((amount) => targetMonthKey === undefined || amount.monthKey < targetMonthKey)
    .sort((a, b) => a.monthKey.localeCompare(b.monthKey));

  switch (expense.estimationStrategy) {
    case 'last-month': {
      const previous = relevant[relevant.length - 1];
      return previous ? previous.actualAmountCents : expense.expectedAmountCents;
    }
    case 'average': {
      const windowSize =
        expense.averageMonths && expense.averageMonths > 0 ? expense.averageMonths : null;
      const window = windowSize ? relevant.slice(-windowSize) : relevant;
      return window.length > 0 ? averageCents(sum(window), window.length) : expense.expectedAmountCents;
    }
    case 'history-average': {
      return relevant.length > 0 ? averageCents(sum(relevant), relevant.length) : expense.expectedAmountCents;
    }
    case 'manual':
    default: {
      return expense.expectedAmountCents;
    }
  }
}