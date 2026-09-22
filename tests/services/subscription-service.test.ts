import type { Subscription } from '../../src/models';
import {
  monthlyChargeCents,
  monthlyFromTotal,
  subscriptionMonths,
  subscriptionTotalCents,
} from '../../src/services/subscription-service';

function subscription(overrides: Partial<Subscription> = {}): Subscription {
  return {
    id: 1,
    name: 'Streaming',
    totalAmountCents: 12000,
    monthlyAmountCents: 1000,
    startMonth: '2025-03',
    endMonth: '2026-02',
    deductMonthly: true,
    active: true,
    sortOrder: 0,
    ...overrides,
  };
}

describe('monthlyChargeCents', () => {
  it('returns the monthly amount while the month falls inside the period', () => {
    expect(monthlyChargeCents(subscription(), '2025-03')).toBe(1000);
    expect(monthlyChargeCents(subscription(), '2026-02')).toBe(1000);
    expect(monthlyChargeCents(subscription(), '2025-10')).toBe(1000);
  });

  it('returns zero outside the start/end period', () => {
    expect(monthlyChargeCents(subscription({ startMonth: '2026-10' }), '2026-09')).toBe(0);
    expect(monthlyChargeCents(subscription({ endMonth: '2026-05' }), '2026-06')).toBe(0);
  });

  it('returns zero when not deducted monthly', () => {
    expect(monthlyChargeCents(subscription({ deductMonthly: false }), '2025-10')).toBe(0);
  });

  it('returns zero when the subscription is inactive', () => {
    expect(monthlyChargeCents(subscription({ active: false }), '2025-10')).toBe(0);
  });
});

describe('subscriptionTotalCents', () => {
  it('totals only the subscriptions charging the given month', () => {
    const result = subscriptionTotalCents(
      [
        subscription({ monthlyAmountCents: 1000 }),
        subscription({ monthlyAmountCents: 2500, active: false }),
        subscription({ monthlyAmountCents: 3000, startMonth: '2027-01' }),
      ],
      '2025-10'
    );
    expect(result).toBe(1000);
  });

  it('returns zero for an empty list', () => {
    expect(subscriptionTotalCents([], '2025-10')).toBe(0);
  });
});

describe('subscriptionMonths', () => {
  it('counts the full period including both endpoints', () => {
    expect(subscriptionMonths(subscription({ startMonth: '2025-10', endMonth: '2026-01' }))).toBe(4);
  });

  it('counts a single-month subscription as one month', () => {
    expect(subscriptionMonths(subscription({ startMonth: '2025-03', endMonth: '2025-03' }))).toBe(1);
  });
});

describe('monthlyFromTotal', () => {
  it('spreads the total evenly across the months', () => {
    expect(monthlyFromTotal(5000, 4)).toBe(1250);
  });

  it('rounds to whole cents', () => {
    expect(monthlyFromTotal(9599, 12)).toBe(800);
  });

  it('returns zero for an invalid period', () => {
    expect(monthlyFromTotal(5000, 0)).toBe(0);
    expect(monthlyFromTotal(5000, -3)).toBe(0);
  });
});