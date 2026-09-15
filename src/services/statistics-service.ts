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

/** Largest single-month spending figure. */
export function highestMonthlySpending(months: { spendingCents: number }[]): number | null {
  if (months.length === 0) {
    return null;
  }
  return months.reduce((max, month) => Math.max(max, month.spendingCents), -Infinity);
}

/** Average reserve adjustment (negative means months saved on average). */
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