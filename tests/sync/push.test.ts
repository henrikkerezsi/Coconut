/// <reference types="node" />

import { DatabaseSync } from 'node:sqlite';
import { MIGRATIONS } from '../../src/database/migrations';
import { pushChanges } from '../../src/sync/push';

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

/**
 * Columns that exist on each remote table (mirrors
 * supabase/migrations/20260918000000_coconut_sync.sql). PostgREST rejects
 * payloads containing columns that are not part of the table, so the fake
 * client reproduces that check.
 */
const REMOTE_COLUMNS: Record<string, string[]> = {
  months: [
    'uuid',
    'user_id',
    'month_key',
    'allowance_cents',
    'starting_reserve_cents',
    'ending_reserve_cents',
    'is_closed',
    'closed_at',
    'updated_at',
  ],
  fixed_expenses: [
    'uuid',
    'user_id',
    'name',
    'expected_amount_cents',
    'kind',
    'recurrence',
    'estimation_strategy',
    'average_months',
    'active',
    'sort_order',
    'updated_at',
  ],
  budgets: [
    'uuid',
    'user_id',
    'name',
    'default_amount_cents',
    'active',
    'sort_order',
    'color',
    'updated_at',
  ],
  yearly_subscriptions: [
    'uuid',
    'user_id',
    'name',
    'yearly_amount_cents',
    'monthly_amount_cents',
    'started_month',
    'billing_month',
    'deduct_monthly',
    'active',
    'sort_order',
    'updated_at',
  ],
  month_fixed_expenses: [
    'uuid',
    'user_id',
    'month_key',
    'fixed_expense_uuid',
    'expected_amount_cents',
    'actual_amount_cents',
    'updated_at',
  ],
  month_budgets: [
    'uuid',
    'user_id',
    'month_key',
    'budget_uuid',
    'planned_amount_cents',
    'updated_at',
  ],
  income: [
    'uuid',
    'user_id',
    'month_key',
    'date',
    'amount_cents',
    'description',
    'note',
    'updated_at',
  ],
  reserve_transfers: [
    'uuid',
    'user_id',
    'month_key',
    'amount_cents',
    'direction',
    'note',
    'updated_at',
  ],
  transactions: [
    'uuid',
    'user_id',
    'month_key',
    'date',
    'amount_cents',
    'budget_uuid',
    'merchant',
    'note',
    'origin_type',
    'origin_id',
    'updated_at',
  ],
  settings: ['key', 'value', 'user_id', 'updated_at'],
  sync_tombstones: ['user_id', 'table_name', 'row_key', 'deleted_at'],
};

class FakeClient {
  readonly tables = new Map<string, Map<string, PostgrestRow>>();
  readonly upsertLog: Array<{ table: string; row: PostgrestRow }> = [];
  readonly failTables = new Set<string>();

  constructor() {
    for (const table of Object.keys(REMOTE_COLUMNS)) {
      this.tables.set(table, new Map());
    }
  }

  from(tableName: string): FakeBuilder {
    return new FakeBuilder(this, tableName);
  }
}

class FakeBuilder {
  private whereColumn: string | null = null;
  private whereValue: unknown = null;

  constructor(
    private readonly fakeClient: FakeClient,
    private readonly tableName: string
  ) {}

  select(_columns: string): this {
    return this;
  }

  eq(column: string, value: unknown): this {
    this.whereColumn = column;
    this.whereValue = value;
    return this;
  }

  maybeSingle(): Promise<{ data: PostgrestRow | null }> {
    const table = this.fakeClient.tables.get(this.tableName);
    if (!table) {
      return Promise.resolve({ data: null });
    }
    for (const row of table.values()) {
      if (row[this.whereColumn as string] === this.whereValue) {
        return Promise.resolve({ data: row });
      }
    }
    return Promise.resolve({ data: null });
  }

  upsert(
    payload: PostgrestRow,
    _options: { onConflict: string }
  ): Promise<{ error: Error | null }> {
    if (this.fakeClient.failTables.has(this.tableName)) {
      return Promise.resolve({ error: new Error(`test failure for ${this.tableName}`) });
    }
    const columns = REMOTE_COLUMNS[this.tableName] ?? [];
    for (const key of Object.keys(payload)) {
      if (!columns.includes(key)) {
        return Promise.resolve({
          error: new Error(
            `PGRST204: Could not find the '${key}' column of '${this.tableName}' in the schema cache`
          ),
        });
      }
    }
    const table = this.fakeClient.tables.get(this.tableName);
    const key = String(payload.uuid ?? payload.month_key ?? payload.key);
    table?.set(key, payload);
    this.fakeClient.upsertLog.push({ table: this.tableName, row: payload });
    return Promise.resolve({ error: null });
  }

  delete(): this {
    return this;
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
      raw.prepare(sql).run(...(params as SqlParams));
      return Promise.resolve(null);
    },
  };
}

async function pushAll(raw: DatabaseSync, client: FakeClient): Promise<void> {
  await pushChanges(client as never, makeDbApi(raw) as never, true);
}

function freshDb(): DatabaseSync {
  const db = new DatabaseSync(':memory:');
  for (const migration of MIGRATIONS.sort((a, b) => a.id - b.id)) {
    db.exec(migration.sql);
  }
  return db;
}

function insertMonth(db: DatabaseSync, monthKey: string): void {
  db.exec(
    `INSERT INTO months (month_key, allowance_cents, starting_reserve_cents)
     VALUES ('${monthKey}', 100000, 0)`
  );
}

function insertBudget(db: DatabaseSync, name: string): number {
  const result = db.prepare('INSERT INTO budgets (name) VALUES (?)').run(name);
  return Number(result.lastInsertRowid);
}

function insertTransaction(
  db: DatabaseSync,
  amountCents: number,
  budgetId: number | null
): number {
  const result = db
    .prepare(
      `INSERT INTO transactions (month_key, date, amount_cents, budget_id, merchant)
       VALUES ('2026-09', '2026-09-18', ?, ?, 'Merchant')`
    )
    .run(amountCents, budgetId);
  return Number(result.lastInsertRowid);
}

function insertWithSuppressedTriggers(db: DatabaseSync, sql: string): void {
  db.exec(`INSERT OR REPLACE INTO sync_meta (key, value) VALUES ('pull_in_progress', '1')`);
  db.exec(sql);
  db.exec(`UPDATE sync_meta SET value = '0' WHERE key = 'pull_in_progress'`);
}

describe('pushChanges full-sync seeding and healing', () => {
  it('uploads rows that were never logged in the outbox', async () => {
    const db = freshDb();
    insertMonth(db, '2026-09');
    insertWithSuppressedTriggers(
      db,
      `INSERT INTO transactions (month_key, date, amount_cents, merchant)
       VALUES ('2026-09', '2026-09-18', 1200, 'Merchant')`
    );
    const before = db.prepare('SELECT uuid FROM transactions').get() as { uuid: string | null };
    expect(before.uuid).toBeNull();

    const client = new FakeClient();
    await pushAll(db, client);

    const healed = db.prepare('SELECT uuid FROM transactions').get() as { uuid: string };
    const remote = client.tables.get('transactions')?.values().next().value;
    expect(remote).toBeDefined();
    expect(remote?.uuid).toBe(healed.uuid);
  });

  it('gives a uuid to pre-existing budgets without one and uploads them', async () => {
    const db = freshDb();
    insertWithSuppressedTriggers(db, `INSERT INTO budgets (name) VALUES ('Groceries')`);
    const before = db.prepare('SELECT uuid FROM budgets').get() as { uuid: string | null };
    expect(before.uuid).toBeNull();

    const client = new FakeClient();
    await pushAll(db, client);

    const healed = db.prepare('SELECT uuid FROM budgets').get() as { uuid: string };
    const remote = client.tables.get('budgets')?.values().next().value;
    expect(remote).toBeDefined();
    expect(remote?.uuid).toBe(healed.uuid);
    expect(remote?.name).toBe('Groceries');
  });

  it('pushes a local edit when the local row is newer than the remote copy', async () => {
    const db = freshDb();
    insertMonth(db, '2026-09');
    insertWithSuppressedTriggers(
      db,
      `INSERT INTO transactions (month_key, date, amount_cents, merchant)
       VALUES ('2026-09', '2026-09-18', 1200, 'Old')`
    );
    insertWithSuppressedTriggers(
      db,
      `UPDATE transactions SET uuid = 'tx-1', updated_at = '2026-09-18T00:00:00.000Z', merchant = 'New'
       WHERE id = 1`
    );
    const client = new FakeClient();
    client.tables.get('transactions')!.set('tx-1', {
      uuid: 'tx-1',
      updated_at: '2026-09-10T00:00:00.000Z',
      user_id: 'user-1',
      merchant: 'Old',
    });

    await pushAll(db, client);

    const remote = client.tables.get('transactions')?.get('tx-1');
    expect(remote?.merchant).toBe('New');
    const logged = client.upsertLog.find(
      (entry) => entry.table === 'transactions' && entry.row.uuid === 'tx-1'
    );
    expect(logged).toBeDefined();
  });

  it('skips and prunes a row whose remote copy is strictly newer', async () => {
    const db = freshDb();
    insertMonth(db, '2026-09');
    insertWithSuppressedTriggers(
      db,
      `INSERT INTO transactions (month_key, date, amount_cents, merchant)
       VALUES ('2026-09', '2026-09-18', 1200, 'Local')`
    );
    insertWithSuppressedTriggers(
      db,
      `UPDATE transactions SET uuid = 'tx-1', updated_at = '2026-09-10T00:00:00.000Z'
       WHERE id = 1`
    );
    const client = new FakeClient();
    client.tables.get('transactions')!.set('tx-1', {
      uuid: 'tx-1',
      updated_at: '2026-09-18T00:00:00.000Z',
      user_id: 'user-1',
      merchant: 'RemoteNew',
    });

    await pushAll(db, client);

    const remote = client.tables.get('transactions')?.get('tx-1');
    expect(remote?.merchant).toBe('RemoteNew');
    expect(
      client.upsertLog.find(
        (entry) => entry.table === 'transactions' && entry.row.uuid === 'tx-1'
      )
    ).toBeUndefined();
  });

  it('uploads budgets before tagged transactions so the remote FK is satisfied', async () => {    const db = freshDb();
    insertMonth(db, '2026-09');
    const budgetId = insertBudget(db, 'Groceries');
    insertTransaction(db, 3450, budgetId);

    const client = new FakeClient();
    await pushAll(db, client);

    const localBudget = db.prepare('SELECT uuid FROM budgets').get() as { uuid: string };
    const remoteBudget = client.tables.get('budgets')?.values().next().value as PostgrestRow;
    const remoteTx = client
      .tables.get('transactions')
      ?.values()
      .next().value as PostgrestRow;

    expect(remoteBudget.uuid).toBe(localBudget.uuid);
    expect(remoteTx.budget_uuid).toBe(localBudget.uuid);

    const positions = client.upsertLog.map((entry, i) => ({ entry, i }));
    const budgetPos = positions.find(
      (p) => p.entry.table === 'budgets' && p.entry.row.uuid === localBudget.uuid
    )?.i as number;
    const txPos = positions.find(
      (p) => p.entry.table === 'transactions' && p.entry.row.uuid === remoteTx.uuid
    )?.i as number;
    expect(budgetPos).toBeLessThan(txPos);
  });

  it('uploads a row for every synced table using only columns that exist remotely', async () => {
    const db = freshDb();
    insertMonth(db, '2026-09');
    const budgetId = insertBudget(db, 'Groceries');
    const fixedId = Number(
      db
        .prepare(
          `INSERT INTO fixed_expenses (name, expected_amount_cents, kind, recurrence, estimation_strategy, active, sort_order)
           VALUES ('Rent', 120000, 'fixed', 'monthly', 'manual', 1, 0)`
        )
        .run().lastInsertRowid
    );
    db.exec(
      `INSERT INTO yearly_subscriptions (name, yearly_amount_cents, monthly_amount_cents, started_month, billing_month)
       VALUES ('Insurance', 120000, 10000, '2026-01', '2026-06')`
    );
    db.exec(
      `INSERT INTO month_fixed_expenses (month_key, fixed_expense_id, expected_amount_cents)
       VALUES ('2026-09', ${fixedId}, 120000)`
    );
    db.exec(
      `INSERT INTO month_budgets (month_key, budget_id, planned_amount_cents)
       VALUES ('2026-09', ${budgetId}, 50000)`
    );
    db.exec(
      `INSERT INTO income (month_key, date, amount_cents, description)
       VALUES ('2026-09', '2026-09-01', 200000, 'Salary')`
    );
    db.exec(
      `INSERT INTO reserve_transfers (month_key, amount_cents, direction)
       VALUES ('2026-09', 5000, 'to-month')`
    );
    insertTransaction(db, 3450, budgetId);

    const client = new FakeClient();
    await pushAll(db, client);

    for (const table of [
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
      expect(client.tables.get(table)?.size ?? 0).toBeGreaterThan(0);
    }
  });

  it('surfaces a remote upsert error instead of swallowing it', async () => {
    const db = freshDb();
    insertMonth(db, '2026-09');
    insertTransaction(db, 3450, null);

    const client = new FakeClient();
    client.failTables.add('transactions');
    await expect(pushAll(db, client)).rejects.toThrow(/Push failed for transactions/);
  });

  it('keeps the local row and outbox when a push fails so it is retried later', async () => {
    const db = freshDb();
    insertMonth(db, '2026-09');
    insertTransaction(db, 3450, null);

    const failingClient = new FakeClient();
    failingClient.failTables.add('transactions');
    await expect(pushAll(db, failingClient)).rejects.toThrow();

    const outbox = db
      .prepare('SELECT table_name, row_key FROM sync_outbox WHERE table_name = ?')
      .all('transactions') as Array<{ table_name: string; row_key: string }>;
    expect(outbox.length).toBe(1);

    const row = db
      .prepare('SELECT uuid FROM transactions WHERE rowid = 1')
      .get() as { uuid: string };
    expect(outbox[0].row_key).toBe(row.uuid);

    const healthyClient = new FakeClient();
    await pushAll(db, healthyClient);
    expect(healthyClient.tables.get('transactions')?.size ?? 0).toBe(1);
    expect(
      db.prepare('SELECT COUNT(*) AS n FROM sync_outbox WHERE table_name = ?').get('transactions') as {
        n: number;
      }
    ).toMatchObject({ n: 0 });
  });
});