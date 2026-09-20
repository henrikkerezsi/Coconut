/// <reference types="node" />

import { DatabaseSync } from 'node:sqlite';
import { MIGRATIONS } from '../../src/database/migrations';
import { pullChanges } from '../../src/sync/pull';

jest.mock('../../src/sync/supabase', () => ({
  getSupabaseUserId: jest.fn().mockResolvedValue('user-1'),
  SyncAuthError: class SyncAuthError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'SyncAuthError';
    }
  },
}));

interface PostgrestRow {
  [key: string]: unknown;
}

class FakeClient {
  readonly tables = new Map<string, Map<string, PostgrestRow>>();

  constructor() {
    for (const table of [
      'settings',
      'sync_tombstones',
      'months',
      'fixed_expenses',
      'budgets',
      'yearly_subscriptions',
      'month_fixed_expenses',
      'month_budgets',
      'income',
      'reserve_transfers',
      'transactions',
    ]) {
      this.tables.set(table, new Map());
    }
  }

  seed(table: string, row: PostgrestRow): void {
    const key = String(row.uuid ?? row.row_key ?? row.key ?? row.month_key);
    this.tables.get(table)?.set(key, row);
  }

  from(tableName: string): FakeBuilder {
    return new FakeBuilder(this, tableName);
  }
}

class FakeBuilder {
  private filters: Array<[column: string, compare: 'gt' | 'in' | 'eq', value: unknown]> = [];
  private orderSpec: { column: string; ascending: boolean } | null = null;

  constructor(
    private readonly fakeClient: FakeClient,
    private readonly tableName: string
  ) {}

  select(_columns: string): this {
    return this;
  }

  gt(column: string, value: unknown): this {
    this.filters.push([column, 'gt', value]);
    return this;
  }

  in(column: string, value: unknown): this {
    this.filters.push([column, 'in', value]);
    return this;
  }

  eq(column: string, value: unknown): this {
    this.filters.push([column, 'eq', value]);
    return this;
  }

  order(column: string, options?: { ascending?: boolean }): this {
    this.orderSpec = { column, ascending: options?.ascending !== false };
    return this;
  }

  private matches(row: PostgrestRow): boolean {
    for (const [column, compare, value] of this.filters) {
      if (compare === 'eq' && row[column] !== value) {
        return false;
      }
      if (compare === 'gt' && !(String(row[column] ?? '') > String(value))) {
        return false;
      }
      if (compare === 'in' && !(value as unknown[]).includes(row[column])) {
        return false;
      }
    }
    return true;
  }

  private run(): PostgrestRow[] {
    const table = this.fakeClient.tables.get(this.tableName) ?? new Map<string, PostgrestRow>();
    let rows = [...table.values()].filter((row) => this.matches(row));
    if (this.orderSpec) {
      const { column, ascending } = this.orderSpec;
      rows = rows.sort((a, b) => {
        const av = String(a[column] ?? '');
        const bv = String(b[column] ?? '');
        return ascending ? av.localeCompare(bv) : bv.localeCompare(av);
      });
    }
    return rows;
  }

  then(
    onFulfilled?: (value: { data: PostgrestRow[]; error: null }) => unknown,
    onRejected?: (reason: unknown) => unknown
  ): Promise<unknown> {
    return Promise.resolve({ data: this.run(), error: null }).then(onFulfilled, onRejected);
  }
}

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

const SINCE = '2020-01-01T00:00:00.000Z';
const UPDATED = '2026-09-18T10:00:00.000Z';

describe('pullChanges', () => {
  it('keeps a row with an unresolved nullable FK, storing NULL instead of dropping it', async () => {
    const raw = freshDb();
    const client = new FakeClient();
    client.seed('months', {
      uuid: 'month-1',
      month_key: '2026-09',
      allowance_cents: 50000,
      starting_reserve_cents: 0,
      ending_reserve_cents: null,
      is_closed: false,
      closed_at: null,
      updated_at: UPDATED,
    });
    client.seed('transactions', {
      uuid: 'tx-ghost-budget',
      month_key: '2026-09',
      date: '2026-09-10',
      amount_cents: 3450,
      budget_uuid: 'budget-vanished',
      merchant: 'Groceries',
      note: null,
      origin_type: null,
      origin_id: null,
      updated_at: UPDATED,
    });

    await pullChanges(client as never, makeDbApi(raw) as never, SINCE);

    const tx = raw
      .prepare('SELECT budget_id, merchant FROM transactions WHERE uuid = ?')
      .get('tx-ghost-budget') as { budget_id: number | null; merchant: string };
    expect(tx).toBeDefined();
    expect(tx.budget_id).toBeNull();
    expect(tx.merchant).toBe('Groceries');
  });

  it('skips a NOT NULL FK row whose parent uuid is missing locally', async () => {
    const raw = freshDb();
    const client = new FakeClient();
    client.seed('months', {
      uuid: 'month-1',
      month_key: '2026-09',
      allowance_cents: 50000,
      starting_reserve_cents: 0,
      ending_reserve_cents: null,
      is_closed: false,
      closed_at: null,
      updated_at: UPDATED,
    });
    client.seed('month_fixed_expenses', {
      uuid: 'mfe-ghost-parent',
      month_key: '2026-09',
      fixed_expense_uuid: 'fixed-vanished',
      expected_amount_cents: 100000,
      actual_amount_cents: null,
      updated_at: UPDATED,
    });

    await pullChanges(client as never, makeDbApi(raw) as never, SINCE);

    const count = (
      raw.prepare('SELECT COUNT(*) AS n FROM month_fixed_expenses').get() as { n: number }
    ).n;
    expect(count).toBe(0);
  });

  it('applies resolved children and keeps their FK ids in sync with pulled parents', async () => {
    const raw = freshDb();
    const client = new FakeClient();
    client.seed('months', {
      uuid: 'month-1',
      month_key: '2026-09',
      allowance_cents: 50000,
      starting_reserve_cents: 0,
      ending_reserve_cents: null,
      is_closed: false,
      closed_at: null,
      updated_at: UPDATED,
    });
    client.seed('fixed_expenses', {
      uuid: 'fixed-1',
      name: 'Rent',
      expected_amount_cents: 120000,
      kind: 'fixed',
      recurrence: 'monthly',
      estimation_strategy: 'manual',
      average_months: null,
      active: true,
      sort_order: 0,
      updated_at: UPDATED,
    });
    client.seed('budgets', {
      uuid: 'budget-1',
      name: 'Groceries',
      default_amount_cents: 50000,
      active: true,
      sort_order: 0,
      color: null,
      updated_at: UPDATED,
    });
    client.seed('month_fixed_expenses', {
      uuid: 'mfe-1',
      month_key: '2026-09',
      fixed_expense_uuid: 'fixed-1',
      expected_amount_cents: 120000,
      actual_amount_cents: 119900,
      updated_at: UPDATED,
    });
    client.seed('month_budgets', {
      uuid: 'mb-1',
      month_key: '2026-09',
      budget_uuid: 'budget-1',
      planned_amount_cents: 50000,
      updated_at: UPDATED,
    });
    client.seed('transactions', {
      uuid: 'tx-1',
      month_key: '2026-09',
      date: '2026-09-10',
      amount_cents: 3450,
      budget_uuid: 'budget-1',
      merchant: 'Groceries',
      note: null,
      origin_type: null,
      origin_id: null,
      updated_at: UPDATED,
    });

    const result = await pullChanges(client as never, makeDbApi(raw) as never, SINCE);
    expect(result.pulled).toBeGreaterThanOrEqual(6);

    const fixed = raw
      .prepare('SELECT id, uuid FROM fixed_expenses WHERE uuid = ?')
      .get('fixed-1') as { id: number; uuid: string };
    const budget = raw
      .prepare('SELECT id, uuid FROM budgets WHERE uuid = ?')
      .get('budget-1') as { id: number; uuid: string };

    const resolvedTx = raw
      .prepare('SELECT budget_id FROM transactions WHERE uuid = ?')
      .get('tx-1') as { budget_id: number };
    expect(resolvedTx.budget_id).toBe(budget.id);

    const resolvedMfe = raw
      .prepare('SELECT fixed_expense_id, actual_amount_cents FROM month_fixed_expenses WHERE uuid = ?')
      .get('mfe-1') as { fixed_expense_id: number; actual_amount_cents: number };
    expect(resolvedMfe.fixed_expense_id).toBe(fixed.id);
    expect(resolvedMfe.actual_amount_cents).toBe(119900);

    const resolvedMb = raw
      .prepare('SELECT budget_id FROM month_budgets WHERE uuid = ?')
      .get('mb-1') as { budget_id: number };
    expect(resolvedMb.budget_id).toBe(budget.id);
  });
});