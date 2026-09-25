import type { MonthKey, MonthSubscription, Subscription } from '../models';

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

/**
 * The subscription charges to freeze into a month. Materialized once per month
 * so later edits, deactivations or deletions cannot change that month's
 * spending.
 */
export function subscriptionChargesForMonth(
  subscriptions: Subscription[],
  monthKey: MonthKey
): { subscriptionId: number | null; name: string; amountCents: number }[] {
  return subscriptions
    .filter((subscription) => monthlyChargeCents(subscription, monthKey) > 0)
    .map((subscription) => ({
      subscriptionId: subscription.id,
      name: subscription.name,
      amountCents: subscription.monthlyAmountCents,
    }));
}

/** Total of the subscription charges already frozen into a month. */
export function monthSubscriptionTotal(charges: MonthSubscription[]): number {
  return charges.reduce((total, charge) => total + charge.amountCents, 0);
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