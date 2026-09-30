import type { Month, MonthKey } from '../models';
import { monthKeyOf } from '../utils/date';

export interface SharedMirrorPlacement {
  /** The month the mirror is recorded against. */
  monthKey: MonthKey;
  /** The date the mirror carries. */
  date: string;
}

export interface ExistingSharedMirror {
  monthKey: MonthKey;
  date: string;
}

function firstDayOf(monthKey: MonthKey): string {
  return `${monthKey}-01`;
}

/**
 * Decides where a shared expense's personal mirror is recorded.
 *
 * A mirror normally follows the expense's own date, in the expense's own month.
 *
 * Once a mirror has been recorded for an expense it belongs to that expense's
 * month, and closing the month afterwards does not move it. The amount was part
 * of that month's spending, so pushing it into the next open month would
 * rewrite a settled period and quietly inflate the new one's totals. This also
 * repairs a mirror that was displaced into a later month: it goes back to the
 * month its expense belongs to, which is restoring where the amount was
 * already counted rather than adding anything in hindsight.
 *
 * A mirror that does not exist yet has no such claim. If its month is closed or
 * was never started, the amount moves forward to the first day of the earliest
 * open month at or after it, so a late-arriving expense is counted rather than
 * dropped.
 *
 * Null means the amount has nowhere to go yet: no open month follows it, so the
 * mirror waits instead of inventing one, because a month only ever comes into
 * existence through the user planning it (see `createPlannedMonth`).
 */
export function resolveSharedMirrorPlacement(
  months: Month[],
  expenseDate: string,
  existing: ExistingSharedMirror | null = null
): SharedMirrorPlacement | null {
  const expenseMonthKey = monthKeyOf(expenseDate);
  const ownMonth = months.find((month) => month.monthKey === expenseMonthKey);

  if (ownMonth) {
    // The expense's own month exists. An already-recorded mirror keeps it, and
    // one displaced into a later month is brought back.
    if (!ownMonth.isClosed || existing !== null) {
      return { monthKey: expenseMonthKey, date: expenseDate };
    }
  }

  const target = months
    .filter((month) => !month.isClosed && month.monthKey >= expenseMonthKey)
    .sort((a, b) => a.monthKey.localeCompare(b.monthKey))[0];
  if (!target) {
    return null;
  }
  return { monthKey: target.monthKey, date: firstDayOf(target.monthKey) };
}
