/// <reference types="node" />

import { DatabaseSync } from 'node:sqlite';
import dayjs from 'dayjs';
import { MIGRATIONS } from '../../src/database/migrations';
import { closePeriod, consolidateOpenPeriods, ensureOpenPeriod } from '../../src/database/sharedPeriods';

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

function seedSpace(raw: DatabaseSync): number {
  raw.exec(`INSERT INTO shared_spaces (name, owner_user_id) VALUES ('Home', 'user-1')`);
  return (raw.prepare('SELECT id FROM shared_spaces').get() as { id: number }).id;
}

describe('ensureOpenPeriod', () => {
  it('opens the first period today', async () => {
    const raw = freshDb();
    const spaceId = seedSpace(raw);
    const period = await ensureOpenPeriod(spaceId, makeDbApi(raw) as never);
    expect(period.startDate).toBe(dayjs().format('YYYY-MM-DD'));
    expect(period.status).toBe('open');
  });

  it('opens the next period on the day the previous one closed', async () => {
    const raw = freshDb();
    const spaceId = seedSpace(raw);
    const first = await ensureOpenPeriod(spaceId, makeDbApi(raw) as never);
    await closePeriod(first.id, '2026-09-18', makeDbApi(raw) as never);

    const next = await ensureOpenPeriod(spaceId, makeDbApi(raw) as never);

    expect(next.startDate).toBe('2026-09-18');
    expect(next.id).not.toBe(first.id);
  });

  it('returns the existing open period instead of creating another', async () => {
    const raw = freshDb();
    const spaceId = seedSpace(raw);
    const first = await ensureOpenPeriod(spaceId, makeDbApi(raw) as never);
    const again = await ensureOpenPeriod(spaceId, makeDbApi(raw) as never);
    expect(again.id).toBe(first.id);
  });
});

describe('consolidateOpenPeriods', () => {
  it('closes duplicate open periods, moving their expenses to the winner', async () => {
    const raw = freshDb();
    const api = makeDbApi(raw) as never;
    const spaceId = seedSpace(raw);
    raw.exec(`INSERT INTO shared_spaces (name, owner_user_id) VALUES ('Work', 'user-1')`);
    const otherSpaceId = (raw.prepare('SELECT id FROM shared_spaces ORDER BY id DESC LIMIT 1').get() as { id: number }).id;
    raw.exec(`INSERT INTO shared_space_members (space_id, user_id, email, role, status, joined_at)
              VALUES (${spaceId}, 'user-1', 'one@example.com', 'owner', 'active', strftime('%Y-%m-%dT%H:%M:%fZ','now'))`);
    raw.exec(`INSERT INTO shared_periods (space_id, uuid, start_date, status, updated_at) VALUES (${spaceId}, 'z-winner', '2026-09-01', 'open', strftime('%Y-%m-%dT%H:%M:%fZ','now'))`);
    const winner = (raw.prepare('SELECT id FROM shared_periods WHERE uuid = ?').get('z-winner') as { id: number }).id;
    raw.exec(`INSERT INTO shared_periods (space_id, uuid, start_date, status, updated_at) VALUES (${spaceId}, 'a-loser', '2026-09-20', 'open', strftime('%Y-%m-%dT%H:%M:%fZ','now'))`);
    const loser = (raw.prepare('SELECT id FROM shared_periods WHERE uuid = ?').get('a-loser') as { id: number }).id;
    raw.exec(`INSERT INTO shared_expenses (space_id, period_id, description, total_amount_cents, date, paid_by_member_id, created_by_user_id)
              VALUES (${spaceId}, ${loser}, 'Takeout', 10000, '2026-09-21', 1, 'user-1')`);
    raw.exec(`INSERT INTO shared_periods (space_id, start_date, status) VALUES (${otherSpaceId}, '2026-09-01', 'open')`);
    raw.exec(`INSERT INTO shared_periods (space_id, start_date, status) VALUES (${otherSpaceId}, '2026-09-05', 'open')`);

    const merged = await consolidateOpenPeriods(api);

    expect(merged).toBe(2);
    const remaining = raw.prepare(`SELECT id, status, end_date FROM shared_periods WHERE space_id = ?`).all(spaceId) as Array<{
      id: number;
      status: string;
      end_date: string | null;
    }>;
    expect(remaining.filter((period) => period.status === 'open')).toHaveLength(1);
    const loserRow = remaining.find((period) => period.id === loser);
    expect(loserRow?.status).toBe('closed');
    expect(loserRow?.end_date).toBe('2026-09-01');
    const expense = raw.prepare('SELECT period_id FROM shared_expenses').get() as { period_id: number };
    expect(expense.period_id).toBe(winner);
  });

  it('picks the same winner on any device (earliest start, then smallest uuid)', async () => {
    const raw = freshDb();
    const api = makeDbApi(raw) as never;
    const spaceId = seedSpace(raw);
    raw.exec(`INSERT INTO shared_periods (space_id, uuid, start_date, status, updated_at) VALUES (${spaceId}, 'b', '2026-09-10', 'open', strftime('%Y-%m-%dT%H:%M:%fZ','now'))`);
    raw.exec(`INSERT INTO shared_periods (space_id, uuid, start_date, status, updated_at) VALUES (${spaceId}, 'a', '2026-09-10', 'open', strftime('%Y-%m-%dT%H:%M:%fZ','now'))`);

    await consolidateOpenPeriods(api);

    const open = raw.prepare(`SELECT uuid FROM shared_periods WHERE status = 'open'`).get() as {
      uuid: string;
    };
    expect(open.uuid).toBe('a');
  });
});
