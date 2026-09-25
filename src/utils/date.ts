import dayjs, { type Dayjs } from 'dayjs';
import type { MonthKey } from '../models';

export const DATABASE_NAME = 'coconut.db';

export const BACKUP_EXTENSION = 'coco';

const DAYJS_MONTH_KEY_FORMAT = 'YYYY-MM';

export const DAYJS_STORE_DATE_FORMAT = 'YYYY-MM-DD';

/** Sentinel end month assigned to subscriptions created before periods existed. */
export const EVERGREEN_MONTH_KEY: MonthKey = '9999-12';

export function monthKeyOf(date: string | Dayjs | Date): MonthKey {
  return dayjs(date).format(DAYJS_MONTH_KEY_FORMAT);
}

export function currentMonthKey(now?: string | Dayjs | Date): MonthKey {
  return monthKeyOf(now ?? dayjs());
}

export function previousMonthKey(monthKey: MonthKey): MonthKey {
  return dayjs(`${monthKey}-01`).subtract(1, 'month').format(DAYJS_MONTH_KEY_FORMAT);
}

export function nextMonthKey(monthKey: MonthKey): MonthKey {
  return dayjs(`${monthKey}-01`).add(1, 'month').format(DAYJS_MONTH_KEY_FORMAT);
}

export function monthLabel(monthKey: MonthKey): string {
  return dayjs(`${monthKey}-01`).format('MMMM YYYY');
}

export function shortMonthLabel(monthKey: MonthKey): string {
  return dayjs(`${monthKey}-01`).format('MMM YYYY');
}

export function dayLabel(isoDate: string): string {
  return dayjs(isoDate).format('ddd, D MMM');
}

export function relativeDayLabel(isoDate: string, today?: string): string {
  const current = dayjs(today ?? dayjs()).startOf('day');
  const date = dayjs(isoDate).startOf('day');
  const diff = current.diff(date, 'day');
  if (diff === 0) {
    return 'Today';
  }
  if (diff === 1) {
    return 'Yesterday';
  }
  return dayLabel(isoDate);
}

/**
 * Share of the month already elapsed, from 0 (first day) to 1 (last day).
 * The current day counts as elapsed, so the 15th of a 30 day month is 0.5.
 */
export function monthProgress(date?: string | Dayjs | Date): number {
  const day = dayjs(date ?? dayjs());
  return day.date() / day.daysInMonth();
}

export function isInMonth(isoDate: string, monthKey: MonthKey): boolean {
  return monthKeyOf(isoDate) === monthKey;
}