import type { MonthKey, Transaction } from '../models';

export interface MonthRecord {
  monthKey: MonthKey;
  allowanceCents: number;
  spendingCents: number;
  reserveAdjustmentCents: number;
  endingReserveCents: number | null;
}

/** Total actual spending for a single month. */
export function totalMonthSpending(
  fixedChargedCents: number,
  discretionaryCents: number
): number {
  return fixedChargedCents + discretionaryCents;
}

/** Average spending per month across the given records. */
export function averageMonthlySpending(months: { spendingCents: number }[]): number | null {
  if (months.length === 0) {
    return null;
  }
  const total = months.reduce((sum, month) => sum + month.spendingCents, 0);
  return Math.round(total / months.length);
}

/** Median spending per month across the given records. */
export function medianMonthlySpending(months: { spendingCents: number }[]): number | null {
  if (months.length === 0) {
    return null;
  }
  const sorted = months.map((month) => month.spendingCents).sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) {
    return sorted[middle];
  }
  return Math.round((sorted[middle - 1] + sorted[middle]) / 2);
}

/** Largest single-month spending figure. */
export function highestMonthlySpending(months: { spendingCents: number }[]): number | null {
  if (months.length === 0) {
    return null;
  }
  return months.reduce((max, month) => Math.max(max, month.spendingCents), -Infinity);
}

/** Average reserve adjustment (positive means saved on average, negative drawn). */
export function averageReserveAdjustment(
  months: { reserveAdjustmentCents: number }[]
): number | null {
  if (months.length === 0) {
    return null;
  }
  const total = months.reduce((sum, month) => sum + month.reserveAdjustmentCents, 0);
  return Math.round(total / months.length);
}

/** Total spending grouped by budget across transactions. */
export function spendingByCategory(transactions: Transaction[]): Map<number, number> {
  const totals = new Map<number, number>();
  for (const transaction of transactions) {
    if (transaction.budgetId === null) {
      continue;
    }
    totals.set(transaction.budgetId, (totals.get(transaction.budgetId) ?? 0) + transaction.amountCents);
  }
  return totals;
}

export interface BudgetMonthPerformance {
  plannedCents: number;
  spentCents: number;
}

/**
 * The average of each month's spent-to-planned ratio for a budget, expressed as
 * a percentage of the monthly plan. Every month with a plan counts equally, a
 * month that was allocated but spent nothing counts as 0%, and a month with no
 * plan is skipped. Returns null when no averaged month exists.
 */
export function averageBudgetPerformance(
  months: readonly BudgetMonthPerformance[]
): number | null {
  let ratioTotal = 0;
  let counted = 0;
  for (const month of months) {
    if (month.plannedCents <= 0) {
      continue;
    }
    ratioTotal += month.spentCents / month.plannedCents;
    counted += 1;
  }
  if (counted === 0) {
    return null;
  }
  return Math.round((ratioTotal / counted) * 100);
}

export interface RatingShares {
  regret: number;
  neutral: number;
  good: number;
}

/**
 * The share of a month's transactions rated regret, neutral and good, as whole
 * percentages. An unrated transaction counts as neutral. Returns null for an
 * empty month.
 */
export function ratingSharesForMonth(
  transactions: readonly Transaction[]
): RatingShares | null {
  if (transactions.length === 0) {
    return null;
  }
  let regret = 0;
  let neutral = 0;
  let good = 0;
  for (const transaction of transactions) {
    if (transaction.rating === 'regret') {
      regret += 1;
    } else if (transaction.rating === 'good') {
      good += 1;
    } else {
      neutral += 1;
    }
  }
  const total = transactions.length;
  return {
    regret: Math.round((regret / total) * 100),
    neutral: Math.round((neutral / total) * 100),
    good: Math.round((good / total) * 100),
  };
}

/** Spending trend: months sorted by key with their spending and reserve adjustment. */
export function monthlySeries(months: MonthRecord[]): MonthRecord[] {
  return [...months].sort((a, b) => a.monthKey.localeCompare(b.monthKey));
}

/** End-of-month reserve balance development across months. */
export function reserveDevelopment(
  months: { monthKey: MonthKey; endingReserveCents: number | null }[]
): { monthKey: MonthKey; reserveCents: number | null }[] {
  return [...months]
    .sort((a, b) => a.monthKey.localeCompare(b.monthKey))
    .map((month) => ({ monthKey: month.monthKey, reserveCents: month.endingReserveCents }));
}