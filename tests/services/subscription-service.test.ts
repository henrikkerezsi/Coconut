import type { YearlySubscription } from '../../src/models';
import {
  monthlyChargeCents,
  monthlyFromYearly,
  monthsHeld,
  monthsUntilNextCharge,
  nextChargeMonth,
  subscriptionTotalCents,
} from '../../src/services/subscription-service';

function subscription(overrides: Partial<YearlySubscription> = {}): YearlySubscription {
  return {
    id: 1,
    name: 'Streaming',
    yearlyAmountCents: 12000,
    monthlyAmountCents: 1000,
    startedMonth: '2025-03',
    billingMonth: '2024-04',
    deductMonthly: true,
    active: true,
    sortOrder: 0,
    ...overrides,
  };
}

describe('monthlyChargeCents', () => {
  it('charges the monthly amount when active and deducting', () => {
    expect(monthlyChargeCents(subscription())).toBe(1000);
  });

  it('charges nothing when deducting is off', () => {
    expect(monthlyChargeCents(subscription({ deductMonthly: false }))).toBe(0);
  });

  it('charges nothing when inactive', () => {
    expect(monthlyChargeCents(subscription({ active: false }))).toBe(0);
  });
});

describe('subscriptionTotalCents', () => {
  it('sums the monthly charges, ignoring non-deducting entries', () => {
    const result = subscriptionTotalCents([
      subscription({ monthlyAmountCents: 1000 }),
      subscription({ monthlyAmountCents: 2500 }),
      subscription({ monthlyAmountCents: 500, deductMonthly: false }),
    ]);
    expect(result).toBe(3500);
  });

  it('returns zero for no subscriptions', () => {
    expect(subscriptionTotalCents([])).toBe(0);
  });
});

describe('monthsHeld', () => {
  it('counts whole months since the start', () => {
    expect(monthsHeld(subscription({ startedMonth: '2025-03' }), '2026-09')).toBe(18);
  });

  it('never reports a negative value for future start months', () => {
    expect(monthsHeld(subscription({ startedMonth: '2026-12' }), '2026-09')).toBe(0);
  });
});

describe('nextChargeMonth', () => {
  it('returns the billing month later in the same year', () => {
    expect(nextChargeMonth(subscription({ billingMonth: '2024-04' }), '2026-01')).toBe('2026-04');
  });

  it('rolls the billing month into the following year once it has passed', () => {
    expect(nextChargeMonth(subscription({ billingMonth: '2024-04' }), '2026-06')).toBe('2027-04');
  });

  it('treats the reference month itself as the charge month', () => {
    expect(nextChargeMonth(subscription({ billingMonth: '2024-04' }), '2026-04')).toBe('2026-04');
  });
});

describe('monthsUntilNextCharge', () => {
  it('counts months until the next charge', () => {
    expect(monthsUntilNextCharge(subscription({ billingMonth: '2024-04' }), '2026-01')).toBe(3);
  });

  it('reports zero when the next charge is this month', () => {
    expect(monthsUntilNextCharge(subscription({ billingMonth: '2024-04' }), '2026-04')).toBe(0);
  });

  it('counts across the year boundary', () => {
    expect(monthsUntilNextCharge(subscription({ billingMonth: '2024-04' }), '2026-06')).toBe(10);
  });
});

describe('monthlyFromYearly', () => {
  it('computes the monthly equivalent of the yearly price', () => {
    expect(monthlyFromYearly(12000)).toBe(1000);
  });

  it('rounds to whole cents', () => {
    expect(monthlyFromYearly(9599)).toBe(800);
  });
});