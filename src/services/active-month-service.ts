import dayjs from 'dayjs';
import type { Month, MonthKey } from '../models';
import { DAYJS_STORE_DATE_FORMAT, monthLabel, nextMonthKey } from '../utils/date';

export interface ActiveMonth {
  monthKey: MonthKey;
  /**
   * True when the period has to be created, which happens when closing a month
   * moved the app on to a period that does not exist yet.
   */
  needsMaterializing: boolean;
  /**
   * True when the period is later than the calendar month, which is the normal
   * state right after a month is closed early.
   */
  isAheadOfCalendar: boolean;
}

/**
 * Resolves the month the app is working on.
 *
 * The month changes only when a month is closed, never because the calendar
 * moved on. So the period on screen is the oldest month that is still open:
 * closing September moves the app to October even while it is still September,
 * and on the 1st of October an unclosed September keeps the app on September.
 *
 * When every month is closed, closing has moved the app on to the period after
 * the latest one, which has to be created. That period is never one that has
 * already gone by, so a month the user skipped entirely is not fabricated with
 * invented history.
 */
export function resolveActiveMonth(months: Month[], calendarMonth: MonthKey): ActiveMonth {
  const sorted = [...months].sort((a, b) => a.monthKey.localeCompare(b.monthKey));
  const firstOpen = sorted.find((month) => !month.isClosed);
  if (firstOpen) {
    return {
      monthKey: firstOpen.monthKey,
      needsMaterializing: false,
      isAheadOfCalendar: firstOpen.monthKey > calendarMonth,
    };
  }
  const afterLatest = sorted.length > 0 ? nextMonthKey(sorted[sorted.length - 1].monthKey) : calendarMonth;
  const monthKey = afterLatest > calendarMonth ? afterLatest : calendarMonth;
  return {
    monthKey,
    needsMaterializing: true,
    isAheadOfCalendar: monthKey > calendarMonth,
  };
}

export interface ActiveMonthDateWindow {
  monthKey: MonthKey;
  /** First day of the month, as 'YYYY-MM-DD'. */
  minimumDate: string;
  /** Last day of the month, as 'YYYY-MM-DD'. */
  maximumDate: string;
}

/**
 * The stretch of dates a record may carry while the given month is the active
 * one: the whole month, from its first day to its last. Because the active
 * period is not the calendar month, this window is not necessarily the days
 * around today: closing September on the 30th opens October, so the only dates
 * that can be recorded are October dates.
 */
export function activeMonthDateWindow(monthKey: MonthKey): ActiveMonthDateWindow {
  const firstDay = dayjs(`${monthKey}-01`);
  return {
    monthKey,
    minimumDate: firstDay.format(DAYJS_STORE_DATE_FORMAT),
    maximumDate: firstDay.endOf('month').format(DAYJS_STORE_DATE_FORMAT),
  };
}

export function isDateInActiveMonth(date: string, monthKey: MonthKey): boolean {
  const value = dayjs(date);
  if (!value.isValid()) {
    return false;
  }
  const { minimumDate, maximumDate } = activeMonthDateWindow(monthKey);
  return !value.isBefore(dayjs(minimumDate), 'day') && !value.isAfter(dayjs(maximumDate), 'day');
}

/**
 * Pulls a date into the active month, which is how a form offers a starting
 * date: today stays today while it falls inside the month, and otherwise the
 * nearest day of the month is used, so the first of a month that has not
 * started yet opens on its first day rather than on a day that cannot be used.
 */
export function clampToActiveMonth(date: string, monthKey: MonthKey): string {
  const { minimumDate, maximumDate } = activeMonthDateWindow(monthKey);
  const value = dayjs(date);
  if (!value.isValid() || value.isBefore(dayjs(minimumDate), 'day')) {
    return minimumDate;
  }
  if (value.isAfter(dayjs(maximumDate), 'day')) {
    return maximumDate;
  }
  return value.format(DAYJS_STORE_DATE_FORMAT);
}

export interface ActiveMonthDateCheck {
  ok: boolean;
  error: string | null;
}

/**
 * Rejects a date that lies outside the active month, so nothing can be
 * backdated into a period that was already closed or dated ahead into a period
 * that has not been worked on yet.
 */
export function validateDateInActiveMonth(
  date: string,
  monthKey: MonthKey,
  subject: string
): ActiveMonthDateCheck {
  if (isDateInActiveMonth(date, monthKey)) {
    return { ok: true, error: null };
  }
  return {
    ok: false,
    error: `${subject} can only be dated in ${monthLabel(monthKey)}.`,
  };
}

