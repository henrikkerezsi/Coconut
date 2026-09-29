/// <reference types="node" />

import { DatabaseSync } from 'node:sqlite';
import { MIGRATIONS } from '../../src/database/migrations';
import { closeMonth } from '../../src/database/months';
import { createReserveTransfer, getReserveTransfers } from '../../src/database/reserve';
import { getMonth, ensureActiveMonth } from '../../src/database/months';
import { buildAutomaticReserveTransfer } from '../../src/services/reserve-service';
import { TRANSACTION_RATINGS } from '../../src/models';

interface TestDb {
  getFirstAsync<T>(sql: string, params?: unknown[]): Promise<T | null>;
  getAllAsync<T>(sql: string, params?: unknown[]): Promise<T[]>;
  runAsync(sql: string, params?: unknown[]): Promise<unknown>;
}

type SqlParams = Parameters<ReturnType<DatabaseSync['prepare']>['get']>;

function makeDbApi(raw: DatabaseSync): TestDb {
  return {
    getFirstAsync<T>(sql: string, params: unknown[] = []): Promise<T | null> {
      const row = raw.prepare(sql).get(...(params as SqlParams));
      return Promise.resolve((row as T | undefined) ?? null);
    },
    getAllAsync<T>(sql: string, params: unknown[] = []): Promise<T[]> {
      const rows = (raw.prepare(sql).all(...(params as SqlParams)) as T[]) ?? [];
      return Promise.resolve(rows);
    },
    runAsync(sql: string, params: unknown[] = []): Promise<unknown> {
      const result = raw.prepare(sql).run(...(params as SqlParams));
      return Promise.resolve({
        lastInsertRowId: Number(result.lastInsertRowid),
        changes: Number(result.changes),
      });
    },
  };
}

function freshDb(): DatabaseSync {
  const db = new DatabaseSync(':memory:');
  for (const migration of MIGRATIONS.sort((a, b) => a.id - b.id)) {
    db.exec(migration.sql);
  }
  return db;
}

const MONTH_KEY = '2026-09';

function seed(raw: DatabaseSync, startingReserveCents: number): void {
  raw
    .prepare(
      `INSERT INTO months (month_key, allowance_cents, starting_reserve_cents, is_closed)
       VALUES (?, ?, ?, 0)`
    )
    .run(MONTH_KEY, 50000, startingReserveCents);
}

async function settle(raw: DatabaseSync, endingReserveCents: number, adjustmentCents: number) {
  const db = makeDbApi(raw) as never;
  const closed = await closeMonth(MONTH_KEY, endingReserveCents, db);
  if (closed) {
    const transfer = buildAutomaticReserveTransfer(adjustmentCents);
    await createReserveTransfer(
      MONTH_KEY,
      transfer.amountCents,
      transfer.direction,
      transfer.note,
      db
    );
  }
  return closed;
}

interface TransferRow {
  month_key: string;
  amount_cents: number;
  direction: string;
  note: string;
}

function transfers(raw: DatabaseSync): TransferRow[] {
  return raw
    .prepare('SELECT month_key, amount_cents, direction, note FROM reserve_transfers ORDER BY id')
    .all() as unknown as TransferRow[];
}

describe('closing a month', () => {
  it('stores the ending reserve balance and marks the month closed', async () => {
    const raw = freshDb();
    seed(raw, 100000);
    expect(await settle(raw, 110000, 10000)).toBe(true);
    const month = await getMonth(MONTH_KEY, makeDbApi(raw) as never);
    expect(month?.isClosed).toBe(true);
    expect(month?.endingReserveCents).toBe(110000);
    expect(month?.closedAt).not.toBeNull();
  });

  it('records the reserve movement the closing applied', async () => {
    const raw = freshDb();
    seed(raw, 100000);
    await settle(raw, 90000, -10000);
    expect(transfers(raw)).toEqual([
      { month_key: MONTH_KEY, amount_cents: 10000, direction: 'to-month', note: 'Automatic month close' },
    ]);
  });

  it('refuses to close a month that is already closed', async () => {
    const raw = freshDb();
    seed(raw, 100000);
    await settle(raw, 110000, 10000);
    expect(await settle(raw, 120000, 10000)).toBe(false);
  });

  it('never records the reserve movement twice when closed again', async () => {
    const raw = freshDb();
    seed(raw, 100000);
    await settle(raw, 110000, 10000);
    await settle(raw, 120000, 20000);
    await settle(raw, 130000, 30000);
    expect(transfers(raw)).toHaveLength(1);
    const month = await getMonth(MONTH_KEY, makeDbApi(raw) as never);
    expect(month?.endingReserveCents).toBe(110000);
  });

  it('keeps each closed month to its own movement', async () => {
    const raw = freshDb();
    seed(raw, 100000);
    await settle(raw, 110000, 10000);
    raw
      .prepare(
        `INSERT INTO months (month_key, allowance_cents, starting_reserve_cents, is_closed)
         VALUES ('2026-10', 50000, 110000, 0)`
      )
      .run();
    const db = makeDbApi(raw) as never;
    await closeMonth('2026-10', 105000, db);
    await createReserveTransfer('2026-10', 5000, 'to-reserve', 'Automatic month close', db);
    expect(transfers(raw).map((row) => row.month_key)).toEqual([MONTH_KEY, '2026-10']);
  });

  it('lists the recorded movements newest first', async () => {
    const raw = freshDb();
    seed(raw, 100000);
    await settle(raw, 110000, 10000);
    raw
      .prepare(
        `INSERT INTO months (month_key, allowance_cents, starting_reserve_cents, is_closed)
         VALUES ('2026-10', 50000, 110000, 0)`
      )
      .run();
    const db = makeDbApi(raw) as never;
    await closeMonth('2026-10', 105000, db);
    await createReserveTransfer('2026-10', 5000, 'to-reserve', 'Automatic month close', db);

    const history = await getReserveTransfers(60, db);
    expect(history.map((entry) => entry.monthKey)).toEqual(['2026-10', '2026-09']);
    expect(history[0]).toMatchObject({
      amountCents: 5000,
      direction: 'to-reserve',
      note: 'Automatic month close',
    });
  });

  it('records a draw from the reserve when a month overspends', async () => {
    const raw = freshDb();
    seed(raw, 100000);
    await settle(raw, 80000, -20000);
    const history = await getReserveTransfers(60, makeDbApi(raw) as never);
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({ amountCents: 20000, direction: 'to-month' });
  });

  it('hands the next period the balance the closed month ended on', async () => {
    const raw = freshDb();
    seed(raw, 100000);
    await settle(raw, 137500, 37500);
    const next = await ensureActiveMonth('2026-10', makeDbApi(raw) as never);
    expect(next.monthKey).toBe('2026-10');
    expect(next.startingReserveCents).toBe(137500);
    expect(next.isClosed).toBe(false);
  });

  it('does not change an existing period when asked to ensure it', async () => {
    const raw = freshDb();
    seed(raw, 100000);
    raw
      .prepare('UPDATE months SET allowance_cents = 4242 WHERE month_key = ?')
      .run(MONTH_KEY);
    const month = await ensureActiveMonth(MONTH_KEY, makeDbApi(raw) as never);
    expect(month.allowanceCents).toBe(4242);
    expect(month.startingReserveCents).toBe(100000);
  });

  it('accepts only the allowed ratings on transactions', () => {
    const raw = freshDb();
    seed(raw, 0);
    raw
      .prepare(
        `INSERT INTO transactions (month_key, date, amount_cents, budget_id, merchant, note)
         VALUES (?, ?, ?, NULL, 'Anything', NULL)`
      )
      .run(MONTH_KEY, '2026-09-02', 1000);
    for (const rating of TRANSACTION_RATINGS) {
      expect(() =>
        raw.prepare('UPDATE transactions SET rating = ?').run(rating)
      ).not.toThrow();
    }
    expect(() => raw.prepare('UPDATE transactions SET rating = ?').run('excellent')).toThrow();
    expect(() => raw.prepare('UPDATE transactions SET rating = ?').run(null)).not.toThrow();
  });
});
