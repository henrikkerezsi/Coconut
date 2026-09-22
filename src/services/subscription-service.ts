import type { MonthKey, Subscription } from '../models';

interface MonthParts {
  year: number;
  month: number;
}

function parseMonthKey(monthKey: MonthKey): MonthParts {
  const [year, month] = monthKey.split('-').map(Number);
  return { year, month };
}

/** Whole months between two keys (negative when `from` is after `to`). */
function monthsBetween(from: MonthKey, to: MonthKey): number {
  const start = parseMonthKey(from);
  const end = parseMonthKey(to);
  return (end.year - start.year) * 12 + (end.month - start.month);
}

/**
 * The amount a subscription charges the given month: its monthly amount when
 * it is active, deducted monthly, and the month falls inside its start/end
 * period. Otherwise zero.
 */
export function monthlyChargeCents(subscription: Subscription, monthKey: MonthKey): number {
  if (!subscription.active || !subscription.deductMonthly) {
    return 0;
  }
  if (monthKey < subscription.startMonth || monthKey > subscription.endMonth) {
    return 0;
  }
  return subscription.monthlyAmountCents;
}

/** Total monthly deduction across a set of subscriptions for a given month. */
export function subscriptionTotalCents(
  subscriptions: Subscription[],
  monthKey: MonthKey
): number {
  return subscriptions.reduce(
    (total, subscription) => total + monthlyChargeCents(subscription, monthKey),
    0
  );
}

/** Whole months the subscription covers, including both its start and end month. */
export function subscriptionMonths(
  subscription: Pick<Subscription, 'startMonth' | 'endMonth'>
): number {
  return monthsBetween(subscription.startMonth, subscription.endMonth) + 1;
}

/** The monthly equivalent of a total spread evenly across the period, rounded to cents. */
export function monthlyFromTotal(totalAmountCents: number, months: number): number {
  if (months <= 0) {
    return 0;
  }
  return Math.round(totalAmountCents / months);
}