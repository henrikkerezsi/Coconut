import {
  activeMonthDateWindow,
  clampToActiveMonth,
  isDateInActiveMonth,
  resolveActiveMonth,
  validateDateInActiveMonth,
} from '../../src/services/active-month-service';
import type { Month, MonthKey } from '../../src/models';

function month(monthKey: MonthKey, isClosed = false): Month {
  return {
    monthKey,
    allowanceCents: 0,
    startingReserveCents: 0,
    endingReserveCents: null,
    isClosed,
    closedAt: null,
  };
}

describe('resolveActiveMonth', () => {
  it('keeps an open month active even when it is behind the calendar', () => {
    // On the 1st of October, September is still open and still the active month.
    const active = resolveActiveMonth([month('2026-09'), month('2026-10')], '2026-10');
    expect(active.monthKey).toBe('2026-09');
    expect(active.needsMaterializing).toBe(false);
    expect(active.isAheadOfCalendar).toBe(false);
  });

  it('moves to the next period as soon as the month is closed', () => {
    // Still September, but September is closed, so October is the active period.
    const active = resolveActiveMonth([month('2026-09', true)], '2026-09');
    expect(active.monthKey).toBe('2026-10');
    expect(active.needsMaterializing).toBe(true);
    expect(active.isAheadOfCalendar).toBe(true);
  });

  it('prefers the oldest open month when several are open', () => {
    const active = resolveActiveMonth(
      [month('2026-09'), month('2026-10'), month('2026-11')],
      '2026-10'
    );
    expect(active.monthKey).toBe('2026-09');
  });

  it('skips over a closed month to the next open one', () => {
    const active = resolveActiveMonth(
      [month('2026-08', true), month('2026-09', true), month('2026-10')],
      '2026-10'
    );
    expect(active.monthKey).toBe('2026-10');
    expect(active.needsMaterializing).toBe(false);
  });

  it('takes the period after the latest month when everything is closed', () => {
    const active = resolveActiveMonth(
      [month('2026-08', true), month('2026-09', true)],
      '2026-09'
    );
    expect(active.monthKey).toBe('2026-10');
    expect(active.needsMaterializing).toBe(true);
  });

  it('starts from the calendar month when there is no history at all', () => {
    const active = resolveActiveMonth([], '2026-09');
    expect(active.monthKey).toBe('2026-09');
    expect(active.needsMaterializing).toBe(true);
    expect(active.isAheadOfCalendar).toBe(false);
  });

  it('does not fabricate a period that has already gone by', () => {
    // Everything closed through August while it is already October: the app moves
    // to the calendar month rather than inventing September.
    const active = resolveActiveMonth(
      [month('2026-07', true), month('2026-08', true)],
      '2026-10'
    );
    expect(active.monthKey).toBe('2026-10');
    expect(active.needsMaterializing).toBe(true);
  });

  it('crosses the year boundary', () => {
    const active = resolveActiveMonth([month('2026-12', true)], '2026-12');
    expect(active.monthKey).toBe('2027-01');
  });

  it('crosses a leap February', () => {
    const active = resolveActiveMonth([month('2028-02', true)], '2028-02');
    expect(active.monthKey).toBe('2028-03');
  });

  it('is not affected by the order the months arrive in', () => {
    const active = resolveActiveMonth(
      [month('2026-10'), month('2026-09', true), month('2026-08', true)],
      '2026-09'
    );
    expect(active.monthKey).toBe('2026-10');
  });
});

describe('activeMonthDateWindow', () => {
  it('spans a 30 day month from its first to its last day', () => {
    expect(activeMonthDateWindow('2026-09')).toEqual({
      monthKey: '2026-09',
      minimumDate: '2026-09-01',
      maximumDate: '2026-09-30',
    });
  });

  it('spans a 31 day month', () => {
    expect(activeMonthDateWindow('2026-10')).toEqual({
      monthKey: '2026-10',
      minimumDate: '2026-10-01',
      maximumDate: '2026-10-31',
    });
  });

  it('spans a leap February', () => {
    expect(activeMonthDateWindow('2028-02').maximumDate).toBe('2028-02-29');
  });

  it('spans a non-leap February', () => {
    expect(activeMonthDateWindow('2026-02').maximumDate).toBe('2026-02-28');
  });
});

describe('isDateInActiveMonth', () => {
  it('accepts the first and the last day of the month', () => {
    expect(isDateInActiveMonth('2026-09-01', '2026-09')).toBe(true);
    expect(isDateInActiveMonth('2026-09-30', '2026-09')).toBe(true);
  });

  it('accepts a day in the middle', () => {
    expect(isDateInActiveMonth('2026-09-15', '2026-09')).toBe(true);
  });

  it('rejects a day of the month before', () => {
    expect(isDateInActiveMonth('2026-08-31', '2026-09')).toBe(false);
  });

  it('rejects a day of the month after', () => {
    expect(isDateInActiveMonth('2026-10-01', '2026-09')).toBe(false);
  });

  it('rejects a day of the same month in another year', () => {
    expect(isDateInActiveMonth('2025-09-15', '2026-09')).toBe(false);
  });

  it('rejects the 31st of a 30 day month', () => {
    expect(isDateInActiveMonth('2026-09-31', '2026-09')).toBe(false);
  });

  it('rejects an unusable date', () => {
    expect(isDateInActiveMonth('', '2026-09')).toBe(false);
    expect(isDateInActiveMonth('not-a-date', '2026-09')).toBe(false);
  });
});

describe('clampToActiveMonth', () => {
  it('keeps a date that already falls inside the month', () => {
    expect(clampToActiveMonth('2026-09-15', '2026-09')).toBe('2026-09-15');
  });

  it('moves a date of the closed month up to the first day of the next', () => {
    // September was closed on the 30th, so the app is on October and that is the
    // closest date that can be recorded.
    expect(clampToActiveMonth('2026-09-30', '2026-10')).toBe('2026-10-01');
  });

  it('moves a date of the not-yet-worked month back to its last day', () => {
    // September is still open on the 1st of October, so October cannot be dated.
    expect(clampToActiveMonth('2026-10-01', '2026-09')).toBe('2026-09-30');
  });

  it('moves an unusable date to the first day of the month', () => {
    expect(clampToActiveMonth('', '2026-09')).toBe('2026-09-01');
  });

  it('crosses the year boundary', () => {
    expect(clampToActiveMonth('2026-12-31', '2027-01')).toBe('2027-01-01');
  });
});

describe('validateDateInActiveMonth', () => {
  it('accepts a date inside the active month', () => {
    expect(validateDateInActiveMonth('2026-09-15', '2026-09', 'A transaction')).toEqual({
      ok: true,
      error: null,
    });
  });

  it('rejects a date in a month that was already closed', () => {
    const check = validateDateInActiveMonth('2026-09-15', '2026-10', 'A transaction');
    expect(check.ok).toBe(false);
    expect(check.error).toBe('A transaction can only be dated in October 2026.');
  });

  it('names the month that is active for income', () => {
    const check = validateDateInActiveMonth('2026-10-05', '2026-09', 'One-off income');
    expect(check.ok).toBe(false);
    expect(check.error).toBe('One-off income can only be dated in September 2026.');
  });
});
