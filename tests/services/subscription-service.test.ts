import type { MonthSubscription, Subscription } from '../../src/models';
import {
  monthlyChargeCents,
  monthlyFromTotal,
  monthSubscriptionTotal,
  subscriptionChargesForMonth,
  subscriptionMonths,
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

describe('subscriptionChargesForMonth', () => {
  it('freezes the charges of the subscriptions covering the month', () => {
    const charges = subscriptionChargesForMonth(
      [
        subscription({ id: 1, name: 'Streaming', monthlyAmountCents: 1000 }),
        subscription({ id: 2, name: 'Gym', monthlyAmountCents: 2500, startMonth: '2025-01' }),
      ],
      '2025-10'
    );
    expect(charges).toEqual([
      { subscriptionId: 1, name: 'Streaming', amountCents: 1000 },
      { subscriptionId: 2, name: 'Gym', amountCents: 2500 },
    ]);
  });

  it('freezes nothing for subscriptions that do not charge the month', () => {
    const charges = subscriptionChargesForMonth(
      [
        subscription({ active: false }),
        subscription({ deductMonthly: false }),
        subscription({ startMonth: '2025-11' }),
        subscription({ endMonth: '2025-09' }),
      ],
      '2025-10'
    );
    expect(charges).toEqual([]);
  });
});

describe('monthSubscriptionTotal', () => {
  function charge(amountCents: number): MonthSubscription {
    return { id: 1, monthKey: '2025-10', subscriptionId: 1, name: 'Streaming', amountCents };
  }

  it('totals the frozen charges', () => {
    expect(monthSubscriptionTotal([charge(1000), charge(2500)])).toBe(3500);
  });

  it('returns zero for a month without charges', () => {
    expect(monthSubscriptionTotal([])).toBe(0);
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