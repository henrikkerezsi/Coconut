/// <reference types="node" />

import { DatabaseSync } from 'node:sqlite';
import dayjs from 'dayjs';
import { MIGRATIONS } from '../../src/database/migrations';
import { closePeriod, ensureOpenPeriod } from '../../src/database/sharedPeriods';

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
