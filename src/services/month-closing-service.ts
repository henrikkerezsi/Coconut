import dayjs, { type Dayjs } from 'dayjs';
import type { Month, MonthKey } from '../models';

/** Hours before month end at which the closing window opens. */
export const CLOSING_WINDOW_LEAD_HOURS = 36;

/** Hours after month end during which the month can still be closed. */
export const CLOSING_WINDOW_TRAIL_HOURS = 24;

export interface MonthClosingWindow {
  start: Dayjs;
  end: Dayjs;
}

/**
 * The period in which a month can be closed: it opens 36 hours before the month
 * ends and closes 24 hours after. A 31-day month is therefore closable from noon
 * on the 29th until midnight at the end of the 1st of the next month.
 */
export function monthClosingWindow(monthKey: MonthKey): MonthClosingWindow {
  const monthEnd = dayjs(`${monthKey}-01`).add(1, 'month').startOf('day');
  return {
    start: monthEnd.subtract(CLOSING_WINDOW_LEAD_HOURS, 'hour'),
    end: monthEnd.add(CLOSING_WINDOW_TRAIL_HOURS, 'hour'),
  };
}

export function isWithinClosingWindow(monthKey: MonthKey, now: Dayjs): boolean {
  const { start, end } = monthClosingWindow(monthKey);
  return !now.isBefore(start) && now.isBefore(end);
}

/**
 * The month the user is able to close right now, or null outside any closing
 * window. Windows are shorter than a month, so at most one month ever qualifies;
 * the oldest match is returned for determinism.
 */
export function findClosableMonth(months: Month[], now: Dayjs): Month | null {
  const closable = months
    .filter((month) => !month.isClosed && isWithinClosingWindow(month.monthKey, now))
    .sort((a, b) => a.monthKey.localeCompare(b.monthKey));
  return closable[0] ?? null;
}

/**
 * Open months whose closing window has passed, oldest first. These are closed by
 * the app without asking, so that a month the user never got to close is still
 * settled rather than left open forever.
 */
export function monthsRequiringAutoClose(months: Month[], now: Dayjs): MonthKey[] {
  return months
    .filter(
      (month) => !month.isClosed && !now.isBefore(monthClosingWindow(month.monthKey).end)
    )
    .map((month) => month.monthKey)
    .sort();
}
