import dayjs from 'dayjs';
import {
  findClosableMonth,
  isWithinClosingWindow,
  monthClosingWindow,
  monthsRequiringAutoClose,
} from '../../src/services/month-closing-service';
import type { Month, MonthKey } from '../../src/models';

function month(monthKey: MonthKey, isClosed = false): Month {
  return {
    monthKey,
    allowanceCents: 50000,
    startingReserveCents: 0,
    endingReserveCents: isClosed ? 0 : null,
    isClosed,
    closedAt: isClosed ? '2026-10-01T00:00:00Z' : null,
  };
}

describe('monthClosingWindow', () => {
  it('opens 36 hours before the month ends', () => {
    const window = monthClosingWindow('2026-09');
    expect(window.start.format('YYYY-MM-DD HH:mm')).toBe('2026-09-29 12:00');
  });

  it('closes 24 hours after the month ended', () => {
    const window = monthClosingWindow('2026-09');
    expect(window.end.format('YYYY-MM-DD HH:mm')).toBe('2026-10-02 00:00');
  });

  it('spans 60 hours in a 30 day month', () => {
    const window = monthClosingWindow('2026-09');
    expect(window.end.diff(window.start, 'hour')).toBe(60);
  });

  it('opens at noon 1.5 days before the end of a 31 day month', () => {
    const window = monthClosingWindow('2026-10');
    expect(window.start.format('YYYY-MM-DD HH:mm')).toBe('2026-10-30 12:00');
  });

  it('opens at noon 1.5 days before the end of a leap February', () => {
    const window = monthClosingWindow('2028-02');
    expect(window.start.format('YYYY-MM-DD HH:mm')).toBe('2028-02-28 12:00');
  });

  it('opens at noon 1.5 days before the end of a plain February', () => {
    const window = monthClosingWindow('2027-02');
    expect(window.start.format('YYYY-MM-DD HH:mm')).toBe('2027-02-27 12:00');
  });

  it('ends on the 2nd of the following month whatever the month length', () => {
    expect(monthClosingWindow('2028-02').end.format('YYYY-MM-DD HH:mm')).toBe('2028-03-02 00:00');
    expect(monthClosingWindow('2026-12').end.format('YYYY-MM-DD HH:mm')).toBe('2027-01-02 00:00');
  });
});

describe('isWithinClosingWindow', () => {
  it('is not yet open 36 hours and a minute before the month ends', () => {
    expect(isWithinClosingWindow('2026-09', dayjs('2026-09-29 11:59'))).toBe(false);
  });

  it('is open at the moment the window opens', () => {
    expect(isWithinClosingWindow('2026-09', dayjs('2026-09-29 12:00'))).toBe(true);
  });

  it('is still open after the month has ended, on the 1st', () => {
    expect(isWithinClosingWindow('2026-09', dayjs('2026-10-01 09:00'))).toBe(true);
  });

  it('is open right up to the end of the 1st', () => {
    expect(isWithinClosingWindow('2026-09', dayjs('2026-10-01 23:59'))).toBe(true);
  });

  it('is closed once the window ends', () => {
    expect(isWithinClosingWindow('2026-09', dayjs('2026-10-02 00:00'))).toBe(false);
  });
});

describe('findClosableMonth', () => {
  it('finds nothing when no month is open', () => {
    const months = [month('2026-09', true)];
    expect(findClosableMonth(months, dayjs('2026-09-29 13:00'))).toBeNull();
  });

  it('finds the current month inside its window', () => {
    const months = [month('2026-08', true), month('2026-09')];
    expect(findClosableMonth(months, dayjs('2026-09-29 13:00'))?.monthKey).toBe('2026-09');
  });

  it('finds the month that just ended while browsing the 1st of the next', () => {
    const months = [month('2026-08', true), month('2026-09'), month('2026-10')];
    expect(findClosableMonth(months, dayjs('2026-10-01 10:00'))?.monthKey).toBe('2026-09');
  });

  it('finds nothing before the window opens', () => {
    const months = [month('2026-09')];
    expect(findClosableMonth(months, dayjs('2026-09-20 12:00'))).toBeNull();
  });

  it('finds nothing once the window has passed', () => {
    const months = [month('2026-09')];
    expect(findClosableMonth(months, dayjs('2026-10-02 00:01'))).toBeNull();
  });
});

describe('monthsRequiringAutoClose', () => {
  it('leaves a month alone while its window is still open', () => {
    expect(monthsRequiringAutoClose([month('2026-09')], dayjs('2026-10-01 10:00'))).toEqual([]);
  });

  it('closes the month automatically once the window has passed', () => {
    expect(monthsRequiringAutoClose([month('2026-09')], dayjs('2026-10-02 00:00'))).toEqual([
      '2026-09',
    ]);
  });

  it('never re-closes a month that is already closed', () => {
    expect(monthsRequiringAutoClose([month('2026-09', true)], dayjs('2026-11-15'))).toEqual([]);
  });

  it('returns every stale month oldest first, and skips the current one', () => {
    const months = [month('2026-10'), month('2026-08'), month('2026-09', true), month('2026-11')];
    expect(monthsRequiringAutoClose(months, dayjs('2026-11-15 09:00'))).toEqual([
      '2026-08',
      '2026-10',
    ]);
  });

  it('leaves the current month open however far into it the app is used', () => {
    expect(monthsRequiringAutoClose([month('2026-11')], dayjs('2026-11-20 09:00'))).toEqual([]);
  });
});
