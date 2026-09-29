/// <reference types="node" />

import { DatabaseSync } from 'node:sqlite';
import dayjs from 'dayjs';
import { MIGRATIONS } from '../../src/database/migrations';
import { monthsRequiringAutoClose } from '../../src/services/month-closing-service';
import { resolveActiveMonth } from '../../src/services/active-month-service';
import type { Month, MonthKey } from '../../src/models';

function toMonth(row: Record<string, unknown>): Month {
  return {
    monthKey: row.month_key as MonthKey,
    allowanceCents: row.allowance_cents as number,
    startingReserveCents: row.starting_reserve_cents as number,
    endingReserveCents: row.ending_reserve_cents as number | null,
    isClosed: row.is_closed === 1,
    closedAt: row.closed_at as string | null,
  };
}

function allMonths(db: DatabaseSync): Month[] {
  return (db.prepare('SELECT * FROM months ORDER BY month_key ASC').all() as Array<Record<string, unknown>>).map(toMonth);
}

describe('catch-up loop, replayed against the device scenario', () => {
  it('leaves September open at 10:38 on 30 September and stays on it', () => {
    const db = new DatabaseSync(':memory:');
    for (const m of MIGRATIONS.sort((a, b) => a.id - b.id)) {
      db.exec(m.sql);
    }
    db.prepare(
      `INSERT INTO months (month_key, allowance_cents, starting_reserve_cents, is_closed)
       VALUES ('2026-09', 200000, 50000, 0)`
    ).run();

    const now = dayjs('2026-09-30 10:38');
    const settled: MonthKey[] = [];
    let active = '';
    for (let pass = 0; pass < 24; pass += 1) {
      for (const stale of monthsRequiringAutoClose(allMonths(db), now)) {
        settled.push(stale);
        db.prepare('UPDATE months SET is_closed = 1 WHERE month_key = ?').run(stale);
      }
      const resolution = resolveActiveMonth(allMonths(db), '2026-09');
      if (!resolution.needsMaterializing) {
        active = resolution.monthKey;
        break;
      }
      db.prepare(
        `INSERT INTO months (month_key, allowance_cents, starting_reserve_cents, is_closed)
         VALUES (?, 200000, 50000, 0)`
      ).run(resolution.monthKey);
    }

    expect(settled).toEqual([]);
    expect(active).toBe('2026-09');
  });

  it('reports what the window looks like on 30 September', () => {
    const now = dayjs('2026-09-30 10:38');
    expect(monthsRequiringAutoClose([toMonth({ month_key: '2026-09', allowance_cents: 0, starting_reserve_cents: 0, ending_reserve_cents: null, is_closed: 0, closed_at: null })], now)).toEqual([]);
  });
});
