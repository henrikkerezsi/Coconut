/// <reference types="node" />

import { DatabaseSync } from 'node:sqlite';
import { MIGRATIONS } from '../../src/database/migrations';
import { pushSharedChanges, pullSharedChanges } from '../../src/sync/shared';
import { SHARED_REMOTE_COLUMNS } from '../../src/sync/shared-serialize';

interface PostgrestRow {
  [key: string]: unknown;
}

const REMOTE_COLUMNS: Record<string, string[]> = {
  ...SHARED_REMOTE_COLUMNS,
  shared_sync_tombstones: ['space_uuid', 'table_name', 'row_key', 'deleted_at'],
};

class FakeQuery {
  private filters: Array<[string, unknown]> = [];
  private comparisons: Array<[string, unknown]> = [];
  private orderSpec: { column: string; ascending: boolean } | null = null;
  private mode: 'select' | 'delete' = 'select';

  constructor(
    private readonly client: FakeClient,
    private readonly table: string
  ) {}

  select(_columns: string): this {
    this.mode = 'select';
    return this;
  }

  delete(): this {
    this.mode = 'delete';
    return this;
  }

  eq(column: string, value: unknown): this {
    this.filters.push([column, value]);
    return this;
  }

  gt(column: string, value: unknown): this {
    this.comparisons.push([column, value]);
    return this;
  }

  order(column: string, options?: { ascending?: boolean }): this {
    this.orderSpec = { column, ascending: options?.ascending !== false };
    return this;
  }

  private matches(row: PostgrestRow): boolean {
    for (const [column, value] of this.filters) {
      if (row[column] !== value) {
        return false;
      }
    }
    for (const [column, value] of this.comparisons) {
      if (!(String(row[column] ?? '') > String(value))) {
        return false;
      }
    }
    return true;
  }

  private run(): { data: PostgrestRow[]; error: null } {
    const table = this.client.tables.get(this.table) ?? new Map<string, PostgrestRow>();
    if (this.mode === 'delete') {
      for (const [key, row] of [...table.entries()]) {
        if (this.matches(row)) {
          table.delete(key);
        }
      }
      return { data: [], error: null };
    }
    let rows = [...table.values()].filter((row) => this.matches(row));
    if (this.orderSpec) {
      const { column, ascending } = this.orderSpec;
      rows = rows.sort((a, b) => {
        const av = String(a[column] ?? '');
        const bv = String(b[column] ?? '');
        return ascending ? av.localeCompare(bv) : bv.localeCompare(av);
      });
    }
    return { data: rows, error: null };
  }

  maybeSingle(): Promise<{ data: PostgrestRow | null; error: null }> {
    const { data } = this.run();
    return Promise.resolve({ data: data[0] ?? null, error: null });
  }

  private persist(payload: PostgrestRow, method: 'insert' | 'upsert'): Promise<{ error: null }> {
    const columns = REMOTE_COLUMNS[this.table] ?? [];
    for (const key of Object.keys(payload)) {
      if (!columns.includes(key)) {
        return Promise.reject(
          new Error(
            `PGRST204: Could not find the '${key}' column of '${this.table}' in the schema cache`
          )
        );
      }
    }
    const table = this.client.tables.get(this.table);
    const key = String(payload.uuid ?? payload.row_key ?? payload.key);
    table?.set(key, payload);
    const log = method === 'insert' ? this.client.insertLog : this.client.upsertLog;
    log.push({ table: this.table, row: payload });
    return Promise.resolve({ error: null });
  }

  upsert(payload: PostgrestRow, _options: { onConflict: string }): Promise<{ error: null }> {
    return this.persist(payload, 'upsert');
  }

  insert(payload: PostgrestRow): Promise<{ error: null }> {
    return this.persist(payload, 'insert');
  }

  then(
    onFulfilled?: (value: { data: PostgrestRow[]; error: null }) => unknown,
    onRejected?: (reason: unknown) => unknown
  ): Promise<unknown> {
    return Promise.resolve(this.run()).then(onFulfilled, onRejected);
  }
}

class FakeClient {
  readonly tables = new Map<string, Map<string, PostgrestRow>>();
  readonly upsertLog: Array<{ table: string; row: PostgrestRow }> = [];
  readonly insertLog: Array<{ table: string; row: PostgrestRow }> = [];

  constructor() {
    for (const table of Object.keys(REMOTE_COLUMNS)) {
      this.tables.set(table, new Map());
    }
  }

  from(table: string): FakeQuery {
    return new FakeQuery(this, table);
  }

  seed(table: string, row: PostgrestRow): void {
    const key = String(row.uuid ?? row.row_key);
    this.tables.get(table)?.set(key, row);
  }

  rows(table: string): PostgrestRow[] {
    return [...(this.tables.get(table)?.values() ?? [])];
  }
}

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

function count(db: DatabaseSync, table: string): number {
  return (db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n;
}

function seedSharedSpace(raw: DatabaseSync): {
  spaceId: number;
  periodId: number;
  memberOne: number;
  memberTwo: number;
  expenseId: number;
} {
  raw.exec(`INSERT INTO shared_spaces (name, owner_user_id) VALUES ('Home', 'user-1')`);
  const spaceId = (raw.prepare('SELECT id FROM shared_spaces').get() as { id: number }).id;
  raw.exec(
    `INSERT INTO shared_space_members (space_id, user_id, email, role, status, joined_at)
     VALUES (${spaceId}, 'user-1', 'one@example.com', 'owner', 'active', '2026-09-01T00:00:00.000Z')`
  );
  const memberOne = (
    raw.prepare('SELECT id FROM shared_space_members ORDER BY id LIMIT 1').get() as { id: number }
  ).id;
  raw.exec(
    `INSERT INTO shared_space_members (space_id, user_id, email, role, status, joined_at)
     VALUES (${spaceId}, 'user-2', 'two@example.com', 'member', 'active', '2026-09-01T00:00:00.000Z')`
  );
  const memberTwo = (
    raw.prepare('SELECT id FROM shared_space_members ORDER BY id DESC LIMIT 1').get() as {
      id: number;
    }
  ).id;
  raw.exec(
    `INSERT INTO shared_periods (space_id, start_date, status) VALUES (${spaceId}, '2026-09-01', 'open')`
  );
  const periodId = (
    raw.prepare('SELECT id FROM shared_periods ORDER BY id DESC LIMIT 1').get() as { id: number }
  ).id;
  raw.exec(
    `INSERT INTO shared_expenses
       (space_id, period_id, description, total_amount_cents, date, paid_by_member_id, created_by_user_id)
     VALUES (${spaceId}, ${periodId}, 'Dinner', 10000, '2026-09-10', ${memberOne}, 'user-1')`
  );
  const expenseId = (
    raw.prepare('SELECT id FROM shared_expenses ORDER BY id DESC LIMIT 1').get() as { id: number }
  ).id;
  raw.exec(
    `INSERT INTO shared_expense_splits (expense_id, member_id, amount_cents)
     VALUES (${expenseId}, ${memberOne}, 4000), (${expenseId}, ${memberTwo}, 6000)`
  );
  return { spaceId, periodId, memberOne, memberTwo, expenseId };
}

const REMOTE_TIMESTAMP = '2026-09-15T00:00:00.000Z';

function seedRemote(client: FakeClient): void {
  client.seed('shared_spaces', {
    uuid: 'space-1',
    name: 'Home',
    owner_user_id: 'user-1',
    deleted: false,
    updated_at: REMOTE_TIMESTAMP,
  });
  client.seed('shared_space_members', {
    uuid: 'member-1',
    space_uuid: 'space-1',
    user_id: 'user-1',
    email: 'one@example.com',
    display_name: null,
    role: 'owner',
    status: 'active',
    joined_at: '2026-09-01T00:00:00.000Z',
    updated_at: REMOTE_TIMESTAMP,
  });
  client.seed('shared_space_members', {
    uuid: 'member-2',
    space_uuid: 'space-1',
    user_id: 'user-2',
    email: 'two@example.com',
    display_name: null,
    role: 'member',
    status: 'active',
    joined_at: '2026-09-01T00:00:00.000Z',
    updated_at: REMOTE_TIMESTAMP,
  });
  client.seed('shared_periods', {
    uuid: 'period-1',
    space_uuid: 'space-1',
    start_date: '2026-09-01',
    end_date: null,
    status: 'open',
    updated_at: REMOTE_TIMESTAMP,
  });
  client.seed('shared_expenses', {
    uuid: 'expense-1',
    space_uuid: 'space-1',
    period_uuid: 'period-1',
    description: 'Dinner',
    total_amount_cents: 10000,
    date: '2026-09-10',
    paid_by_member_uuid: 'member-1',
    note: null,
    created_by_user_id: 'user-1',
    deleted: false,
    updated_at: REMOTE_TIMESTAMP,
  });
  client.seed('shared_expense_splits', {
    uuid: 'split-1',
    expense_uuid: 'expense-1',
    member_uuid: 'member-1',
    amount_cents: 4000,
    updated_at: REMOTE_TIMESTAMP,
  });
  client.seed('shared_expense_splits', {
    uuid: 'split-2',
    expense_uuid: 'expense-1',
    member_uuid: 'member-2',
    amount_cents: 6000,
    updated_at: REMOTE_TIMESTAMP,
  });
}

describe('pushSharedChanges', () => {
  it('uploads shared rows with foreign keys resolved to uuids', async () => {
    const raw = freshDb();
    seedSharedSpace(raw);
    const client = new FakeClient();

    await pushSharedChanges(client as never, makeDbApi(raw) as never, 'user-1');

    const localSpaceUuid = (raw.prepare('SELECT uuid FROM shared_spaces').get() as { uuid: string })
      .uuid;
    const localPeriodUuid = (
      raw.prepare('SELECT uuid FROM shared_periods').get() as { uuid: string }
    ).uuid;
    const localExpenseUuid = (
      raw.prepare('SELECT uuid FROM shared_expenses').get() as { uuid: string }
    ).uuid;
    const localMemberUuid = (
      raw.prepare('SELECT uuid FROM shared_space_members ORDER BY id LIMIT 1').get() as {
        uuid: string;
      }
    ).uuid;

    expect(client.rows('shared_spaces')).toHaveLength(1);
    expect(client.rows('shared_space_members')).toHaveLength(2);
    expect(client.rows('shared_periods')).toHaveLength(1);
    expect(client.rows('shared_expenses')).toHaveLength(1);
    expect(client.rows('shared_expense_splits')).toHaveLength(2);

    const remoteSpace = client.rows('shared_spaces')[0];
    expect(remoteSpace.owner_user_id).toBe('user-1');

    const remoteMember = client
      .rows('shared_space_members')
      .find((row) => row.uuid === localMemberUuid) as PostgrestRow;
    const remoteExpense = client.rows('shared_expenses')[0];
    const remoteSplit = client
      .rows('shared_expense_splits')
      .find((row) => row.expense_uuid === localExpenseUuid) as PostgrestRow;

    expect(remoteMember.space_uuid).toBe(localSpaceUuid);
    expect(remoteExpense.space_uuid).toBe(localSpaceUuid);
    expect(remoteExpense.period_uuid).toBe(localPeriodUuid);
    expect(remoteExpense.paid_by_member_uuid).toBe(localMemberUuid);
    expect(remoteSplit.member_uuid).toBeDefined();
    expect(count(raw, 'sync_outbox')).toBe(0);
  });

  it('claims a space with no local owner on behalf of the pushing user', async () => {
    const raw = freshDb();
    raw.exec(`INSERT INTO shared_spaces (name, owner_user_id) VALUES ('Home', NULL)`);
    const client = new FakeClient();

    await pushSharedChanges(client as never, makeDbApi(raw) as never, 'user-9');

    const remoteSpace = client.rows('shared_spaces')[0];
    expect(remoteSpace).toBeDefined();
    expect(remoteSpace.owner_user_id).toBe('user-9');
  });

  it('never sends an owner when pushing an existing remote space (member device)', async () => {
    const raw = freshDb();
    const client = new FakeClient();
    seedRemote(client);
    await pullSharedChanges(client as never, makeDbApi(raw) as never);
    expect(count(raw, 'shared_spaces')).toBe(1);
    raw.exec(`UPDATE shared_spaces SET name = 'Home Renamed'`);

    await pushSharedChanges(client as never, makeDbApi(raw) as never, 'user-2');

    const spacePayload = client.upsertLog.find(
      (entry) => entry.table === 'shared_spaces'
    )?.row;
    expect(spacePayload).toBeDefined();
    expect(spacePayload?.owner_user_id).toBeUndefined();
  });

  it('propagates a deleted expense as a remote tombstone', async () => {
    const raw = freshDb();
    const fixture = seedSharedSpace(raw);
    const client = new FakeClient();
    await pushSharedChanges(client as never, makeDbApi(raw) as never, 'user-1');
    expect(client.rows('shared_expenses')).toHaveLength(1);

    raw.exec(`DELETE FROM shared_expenses WHERE id = ${fixture.expenseId}`);
    await pushSharedChanges(client as never, makeDbApi(raw) as never, 'user-1');

    expect(client.rows('shared_expenses')).toHaveLength(0);
    expect(client.rows('shared_expense_splits')).toHaveLength(0);
    const tombstones = client.rows('shared_sync_tombstones');
    expect(tombstones.map((row) => row.table_name)).toContain('shared_expenses');
    expect(count(raw, 'shared_sync_tombstones')).toBe(0);
  });

  it('inserts brand-new rows instead of upserting them so first-time shared rows pass RLS', async () => {
    const raw = freshDb();
    seedSharedSpace(raw);
    const client = new FakeClient();

    await pushSharedChanges(client as never, makeDbApi(raw) as never, 'user-1');

    expect(client.insertLog).toHaveLength(7);
    expect(client.upsertLog).toHaveLength(0);
    const spaceInsert = client.insertLog.find((entry) => entry.table === 'shared_spaces');
    expect(spaceInsert?.row.owner_user_id).toBe('user-1');

    raw.exec(`UPDATE shared_spaces SET name = 'Home renamed'`);
    await pushSharedChanges(client as never, makeDbApi(raw) as never, 'user-1');

    expect(client.upsertLog).toHaveLength(7);
    expect(client.upsertLog.find((entry) => entry.table === 'shared_spaces')?.row.owner_user_id).toBeUndefined();
    expect(client.insertLog).toHaveLength(7);
  });
});

describe('pullSharedChanges', () => {
  it('inserts remote rows, keeps their uuids, and rewrites foreign keys', async () => {
    const raw = freshDb();
    const client = new FakeClient();
    seedRemote(client);

    await pullSharedChanges(client as never, makeDbApi(raw) as never);

    const space = raw
      .prepare('SELECT id, uuid, owner_user_id FROM shared_spaces')
      .get() as { id: number; uuid: string; owner_user_id: string | null };
    const member = raw
      .prepare('SELECT id, uuid, space_id FROM shared_space_members ORDER BY id LIMIT 1')
      .get() as { id: number; uuid: string; space_id: number };
    const period = raw.prepare('SELECT id, uuid FROM shared_periods').get() as {
      id: number;
      uuid: string;
    };
    const expense = raw
      .prepare(
        'SELECT id, uuid, space_id, period_id, paid_by_member_id FROM shared_expenses'
      )
      .get() as {
      id: number;
      uuid: string;
      space_id: number;
      period_id: number;
      paid_by_member_id: number;
    };
    const split = raw
      .prepare('SELECT uuid, expense_id, member_id FROM shared_expense_splits ORDER BY id LIMIT 1')
      .get() as { uuid: string; expense_id: number; member_id: number };

    expect(space.uuid).toBe('space-1');
    expect(space.owner_user_id).toBe('user-1');
    expect(member.uuid).toBe('member-1');
    expect(period.uuid).toBe('period-1');
    expect(expense.uuid).toBe('expense-1');
    expect(split.uuid).toBe('split-1');

    expect(member.space_id).toBe(space.id);
    expect(expense.space_id).toBe(space.id);
    expect(expense.period_id).toBe(period.id);
    expect(expense.paid_by_member_id).toBe(member.id);
    expect(split.expense_id).toBe(expense.id);
    expect(split.member_id).toBe(member.id);

    expect(count(raw, 'sync_outbox')).toBe(0);
  });

  it('removes local rows for remote tombstones', async () => {
    const raw = freshDb();
    const client = new FakeClient();
    seedRemote(client);
    await pullSharedChanges(client as never, makeDbApi(raw) as never);
    expect(count(raw, 'shared_expenses')).toBe(1);

    client.tables.get('shared_expenses')?.clear();
    client.tables.get('shared_expense_splits')?.clear();
    client.seed('shared_sync_tombstones', {
      space_uuid: 'space-1',
      table_name: 'shared_expenses',
      row_key: 'expense-1',
      deleted_at: '2026-10-01T00:00:00.000Z',
    });
    await pullSharedChanges(client as never, makeDbApi(raw) as never);

    expect(count(raw, 'shared_expenses')).toBe(0);
    expect(count(raw, 'shared_expense_splits')).toBe(0);
  });
});
