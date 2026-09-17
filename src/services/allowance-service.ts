import type { ReserveAdjustment } from '../models';

/**
 * Allowance not yet covered by actual spending.
 * Positive when spending is below the allowance, negative when it exceeds it.
 */
export function remainingAllowance(allowanceCents: number, actualSpendingCents: number): number {
  return allowanceCents - actualSpendingCents;
}

/**
 * Difference between actual and planned spending for a period.
 * Positive when the user spent more than planned.
 */
export function spendingDifference(actualSpendingCents: number, plannedSpendingCents: number): number {
  return actualSpendingCents - plannedSpendingCents;
}

/**
 * The reserve adjustment produced by a month:
 * (monthly allowance + one-off income) - actual monthly spending.
 * A positive value means money is saved into the reserve; a negative value
 * means spending drew from it.
 */
export function reserveAdjustmentCents(
  actualSpendingCents: number,
  allowanceCents: number,
  incomeCents = 0
): ReserveAdjustment {
  const adjustmentCents = allowanceCents + incomeCents - actualSpendingCents;
  return {
    adjustmentCents,
    overspent: adjustmentCents < 0,
  };
}

/**
 * Returns how much the user can still plan against the allowance, ignoring
 * spending that is already committed. Used only for planning display.
 */
export function unplannedAllowance(allowanceCents: number, committedCents: number): number {
  return allowanceCents - committedCents;
}