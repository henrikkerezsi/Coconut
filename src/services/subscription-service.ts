import type { MonthKey, YearlySubscription } from '../models';

interface MonthParts {
  year: number;
  month: number;
}

function parseMonthKey(monthKey: MonthKey): MonthParts {
  const [year, month] = monthKey.split('-').map(Number);
  return { year, month };
}

function monthKeyFrom(parts: MonthParts): MonthKey {
  return `${String(parts.year)}-${String(parts.month).padStart(2, '0')}`;
}

function monthsBetween(from: MonthKey, to: MonthKey): number {
  const start = parseMonthKey(from);
  const end = parseMonthKey(to);
  return (end.year - start.year) * 12 + (end.month - start.month);
}

/**
 * The amount a subscription charges the current month: its monthly amount when
 * it is active and configured to be deducted each month, otherwise zero.
 */
export function monthlyChargeCents(subscription: YearlySubscription): number {
  if (!subscription.active || !subscription.deductMonthly) {
    return 0;
  }
  return subscription.monthlyAmountCents;
}

/** Total monthly deduction across a set of subscriptions. */
export function subscriptionTotalCents(subscriptions: YearlySubscription[]): number {
  return subscriptions.reduce((total, subscription) => total + monthlyChargeCents(subscription), 0);
}

/** Whole months between the start of the subscription and the reference month. */
export function monthsHeld(
  subscription: YearlySubscription,
  referenceMonth: MonthKey
): number {
  return Math.max(0, monthsBetween(subscription.startedMonth, referenceMonth));
}

/**
 * The month of the next yearly charge, based on the billing month of the year.
 * Returns the reference month itself when the charge happens in that month.
 */
export function nextChargeMonth(
  subscription: YearlySubscription,
  referenceMonth: MonthKey
): MonthKey {
  const reference = parseMonthKey(referenceMonth);
  let candidate = monthKeyFrom({ year: reference.year, month: parseMonthKey(subscription.billingMonth).month });
  if (candidate < referenceMonth) {
    candidate = monthKeyFrom({ year: reference.year + 1, month: parseMonthKey(subscription.billingMonth).month });
  }
  return candidate;
}

/** Whole months until the next yearly charge; zero when it happens this month. */
export function monthsUntilNextCharge(
  subscription: YearlySubscription,
  referenceMonth: MonthKey
): number {
  return Math.max(0, monthsBetween(referenceMonth, nextChargeMonth(subscription, referenceMonth)));
}

/** The monthly equivalent of the yearly price, rounded to whole cents. */
export function monthlyFromYearly(yearlyAmountCents: number): number {
  return Math.round(yearlyAmountCents / 12);
}