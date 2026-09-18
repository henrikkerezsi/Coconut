/// <reference types="node" />

import { DatabaseSync } from 'node:sqlite';
import { MIGRATIONS } from '../../src/database/migrations';
import {
  createSharedExpense,
  getExpenseTraceByOriginId,
  getExpenseTracesByOriginIds,
  updateSharedExpense,
} from '../../src/database/sharedExpenses';

interface TestDb {
  getFirstAsync<T>(sql: string, params?: unknown[]): Promise<T | null>;
  getAllAsync<T>(sql: string, params?: unknown[]): Promise<T[]>;
  runAsync(sql: string, params?: unknown[]): Promise<unknown>;
  withTransactionAsync<T>(task: () => Promise<T>): Promise<T>;
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
    withTransactionAsync<T>(task: () => Promise<T>): Promise<T> {
      return task();
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

interface Fixture {
  spaceId: number;
  periodId: number;
  memberOne: number;
  memberTwo: number;
}

function seedSpace(db: DatabaseSync): Fixture {
  db.exec(`INSERT INTO shared_spaces (name, owner_user_id) VALUES ('Home', 'user-1')`);
  const spaceId = (db.prepare('SELECT id FROM shared_spaces').get() as { id: number }).id;
  db.exec(
    `INSERT INTO shared_space_members (space_id, user_id, email, display_name, role, status, joined_at)
     VALUES (${spaceId}, 'user-1', 'one@example.com', 'Alice', 'owner', 'active', '2026-09-01T00:00:00.000Z')`
  );
  const memberOne = (
    db.prepare('SELECT id FROM shared_space_members ORDER BY id LIMIT 1').get() as { id: number }
  ).id;
  db.exec(
    `INSERT INTO shared_space_members (space_id, user_id, email, role, status, joined_at)
     VALUES (${spaceId}, 'user-2', 'two@example.com', 'member', 'active', '2026-09-01T00:00:00.000Z')`
  );
  const memberTwo = (
    db.prepare('SELECT id FROM shared_space_members ORDER BY id DESC LIMIT 1').get() as {
      id: number;
    }
  ).id;
  db.exec(
    `INSERT INTO shared_periods (space_id, start_date, status) VALUES (${spaceId}, '2026-09-01', 'open')`
  );
  const periodId = (
    db.prepare('SELECT id FROM shared_periods ORDER BY id DESC LIMIT 1').get() as { id: number }
  ).id;
  return { spaceId, periodId, memberOne, memberTwo };
}

describe('shared expense traces', () => {
  it('resolves space, payer name and total for an expense uuid', async () => {
    const raw = freshDb();
    const fixture = seedSpace(raw);
    const expense = await createSharedExpense(
      {
        spaceId: fixture.spaceId,
        periodId: fixture.periodId,
        description: 'Dinner',
        totalAmountCents: 10000,
        date: '2026-09-10',
        paidByMemberId: fixture.memberOne,
        note: null,
        createdByUserId: 'user-1',
      },
      [
        { memberId: fixture.memberOne, amountCents: 4000 },
        { memberId: fixture.memberTwo, amountCents: 6000 },
      ],
      makeDbApi(raw) as never
    );
    const uuid = (
      raw.prepare('SELECT uuid FROM shared_expenses WHERE id = ?').get(expense) as { uuid: string }
    ).uuid;

    const trace = await getExpenseTraceByOriginId(uuid, makeDbApi(raw) as never);

    expect(trace?.spaceName).toBe('Home');
    expect(trace?.paidByName).toBe('Alice');
    expect(trace?.totalAmountCents).toBe(10000);
    expect(trace?.expenseId).toBe(expense);
    expect(trace?.spaceId).toBe(fixture.spaceId);
  });

  it('falls back to email when the payer has no display name', async () => {
    const raw = freshDb();
    const fixture = seedSpace(raw);
    const expense = await createSharedExpense(
      {
        spaceId: fixture.spaceId,
        periodId: fixture.periodId,
        description: 'Dinner',
        totalAmountCents: 10000,
        date: '2026-09-10',
        paidByMemberId: fixture.memberTwo,
        note: null,
        createdByUserId: 'user-1',
      },
      [
        { memberId: fixture.memberOne, amountCents: 4000 },
        { memberId: fixture.memberTwo, amountCents: 6000 },
      ],
      makeDbApi(raw) as never
    );
    const uuid = (
      raw.prepare('SELECT uuid FROM shared_expenses WHERE id = ?').get(expense) as { uuid: string }
    ).uuid;

    const trace = await getExpenseTraceByOriginId(uuid, makeDbApi(raw) as never);

    expect(trace?.paidByName).toBe('two@example.com');
  });

  it('returns null for an unknown uuid and excludes deleted expenses', async () => {
    const raw = freshDb();
    const fixture = seedSpace(raw);
    const expense = await createSharedExpense(
      {
        spaceId: fixture.spaceId,
        periodId: fixture.periodId,
        description: 'Dinner',
        totalAmountCents: 10000,
        date: '2026-09-10',
        paidByMemberId: fixture.memberOne,
        note: null,
        createdByUserId: 'user-1',
      },
      [
        { memberId: fixture.memberOne, amountCents: 4000 },
        { memberId: fixture.memberTwo, amountCents: 6000 },
      ],
      makeDbApi(raw) as never
    );
    const uuid = (
      raw.prepare('SELECT uuid FROM shared_expenses WHERE id = ?').get(expense) as { uuid: string }
    ).uuid;

    expect(await getExpenseTraceByOriginId('missing-uuid', makeDbApi(raw) as never)).toBeNull();

    raw.exec(`DELETE FROM shared_expenses WHERE id = ${expense}`);
    expect(await getExpenseTraceByOriginId(uuid, makeDbApi(raw) as never)).toBeNull();
  });

  it('resolves multiple origins in one query', async () => {
    const raw = freshDb();
    const fixture = seedSpace(raw);
    const input = {
      spaceId: fixture.spaceId,
      periodId: fixture.periodId,
      description: 'Dinner',
      totalAmountCents: 10000,
      date: '2026-09-10',
      paidByMemberId: fixture.memberOne,
      note: null,
      createdByUserId: 'user-1',
    };
    const first = await createSharedExpense(
      input,
      [
        { memberId: fixture.memberOne, amountCents: 4000 },
        { memberId: fixture.memberTwo, amountCents: 6000 },
      ],
      makeDbApi(raw) as never
    );
    const second = await createSharedExpense(
      input,
      [
        { memberId: fixture.memberOne, amountCents: 5000 },
        { memberId: fixture.memberTwo, amountCents: 5000 },
      ],
      makeDbApi(raw) as never
    );
    const uuidOf = (id: number) =>
      (raw.prepare('SELECT uuid FROM shared_expenses WHERE id = ?').get(id) as { uuid: string })
        .uuid;

    const traces = await getExpenseTracesByOriginIds(
      [uuidOf(first), uuidOf(second)],
      makeDbApi(raw) as never
    );

    expect(traces).toHaveLength(2);
    expect(traces[0].expenseId).toBe(first);
    expect(traces[1].expenseId).toBe(second);
  });
});

describe('updateSharedExpense', () => {
  it('updates the expense and replaces its splits', async () => {
    const raw = freshDb();
    const fixture = seedSpace(raw);
    const expense = await createSharedExpense(
      {
        spaceId: fixture.spaceId,
        periodId: fixture.periodId,
        description: 'Dinner',
        totalAmountCents: 10000,
        date: '2026-09-10',
        paidByMemberId: fixture.memberOne,
        note: null,
        createdByUserId: 'user-1',
      },
      [
        { memberId: fixture.memberOne, amountCents: 4000 },
        { memberId: fixture.memberTwo, amountCents: 6000 },
      ],
      makeDbApi(raw) as never
    );

    await updateSharedExpense(
      expense,
      {
        spaceId: fixture.spaceId,
        periodId: fixture.periodId,
        description: 'Dinner + drinks',
        totalAmountCents: 12000,
        date: '2026-09-10',
        paidByMemberId: fixture.memberTwo,
        note: null,
        createdByUserId: 'user-1',
      },
      [
        { memberId: fixture.memberOne, amountCents: 5000 },
        { memberId: fixture.memberTwo, amountCents: 7000 },
      ],
      makeDbApi(raw) as never
    );

    const expenseRow = raw
      .prepare('SELECT * FROM shared_expenses WHERE id = ?')
      .get(expense) as Record<string, unknown>;
    expect(expenseRow.description).toBe('Dinner + drinks');
    expect(expenseRow.total_amount_cents).toBe(12000);
    expect(expenseRow.paid_by_member_id).toBe(fixture.memberTwo);

    const splits = raw
      .prepare('SELECT member_id, amount_cents FROM shared_expense_splits WHERE expense_id = ?')
      .all(expense) as Array<{ member_id: number; amount_cents: number }>;
    expect(splits).toEqual([
      { member_id: fixture.memberOne, amount_cents: 5000 },
      { member_id: fixture.memberTwo, amount_cents: 7000 },
    ]);
  });
});