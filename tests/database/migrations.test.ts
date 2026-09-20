/// <reference types="node" />

import { DatabaseSync } from 'node:sqlite';
import { MIGRATIONS } from '../../src/database/migrations';

function applyMigrations(db: DatabaseSync, fromId: number, toId: number): void {
  const pending = MIGRATIONS.filter((m) => m.id >= fromId && m.id <= toId).sort(
    (a, b) => a.id - b.id
  );
  for (const migration of pending) {
    db.exec(migration.sql);
  }
}

function freshDb(): DatabaseSync {
  const db = new DatabaseSync(':memory:');
  applyMigrations(db, 1, 10);
  return db;
}

function insertTransaction(db: DatabaseSync, amountCents: number, merchant: string): void {
  db.exec(
    `INSERT INTO transactions (month_key, date, amount_cents, merchant)
     VALUES ('2026-09', '2026-09-18', ${amountCents}, '${merchant}')`
  );
}

describe('sync change-capture triggers (migration 7 + 9)', () => {
  it('applies the full migration chain on a fresh database', () => {
    const db = freshDb();
    db.exec(
      `INSERT INTO months (month_key, allowance_cents, starting_reserve_cents)
       VALUES ('2026-09', 100000, 0)`
    );
    expect(() => insertTransaction(db, 1000, 'A')).not.toThrow();
  });

  it('logs a new transaction to the outbox with its uuid as row_key', () => {
    const db = freshDb();
    db.exec(
      `INSERT INTO months (month_key, allowance_cents, starting_reserve_cents)
       VALUES ('2026-09', 100000, 0)`
    );
    insertTransaction(db, 1000, 'A');
    const tx = db
      .prepare('SELECT id, uuid, updated_at FROM transactions')
      .get() as { id: number; uuid: string | null; updated_at: string | null };
    const outbox = db
      .prepare(
        `SELECT table_name, row_key FROM sync_outbox WHERE table_name = 'transactions'`
      )
      .all() as Array<{ table_name: string; row_key: string }>;
    expect(tx.uuid).toBeTruthy();
    expect(tx.updated_at).toBeTruthy();
    expect(outbox).toHaveLength(1);
    expect(outbox[0].row_key).toBe(tx.uuid);
  });

  it('accepts repeated inserts in the same month without UNIQUE conflicts', () => {
    const db = freshDb();
    db.exec(
      `INSERT INTO months (month_key, allowance_cents, starting_reserve_cents)
       VALUES ('2026-09', 100000, 0)`
    );
    expect(() => {
      insertTransaction(db, 1000, 'A');
      insertTransaction(db, 2000, 'B');
      insertTransaction(db, 3000, 'C');
    }).not.toThrow();
    const outbox = db
      .prepare(`SELECT row_key FROM sync_outbox WHERE table_name = 'transactions'`)
      .all() as Array<{ row_key: string }>;
    expect(outbox).toHaveLength(3);
    expect(new Set(outbox.map((row) => row.row_key)).size).toBe(3);
  });

  it('dedupes outbox rows when a transaction is updated', () => {
    const db = freshDb();
    db.exec(
      `INSERT INTO months (month_key, allowance_cents, starting_reserve_cents)
       VALUES ('2026-09', 100000, 0)`
    );
    insertTransaction(db, 1000, 'A');
    const tx = db
      .prepare('SELECT id, uuid FROM transactions')
      .get() as { id: number; uuid: string };
    db.exec(`UPDATE transactions SET amount_cents = 9999 WHERE id = ${tx.id}`);
    const outbox = db
      .prepare(`SELECT row_key FROM sync_outbox WHERE table_name = 'transactions'`)
      .all() as Array<{ row_key: string }>;
    expect(outbox).toHaveLength(1);
    expect(outbox[0].row_key).toBe(tx.uuid);
  });

  it('does not log while a pull is in progress', () => {
    const db = freshDb();
    db.exec(
      `INSERT INTO months (month_key, allowance_cents, starting_reserve_cents)
       VALUES ('2026-09', 100000, 0)`
    );
    db.exec(
      `INSERT INTO sync_meta (key, value) VALUES ('pull_in_progress', '1')`
    );
    insertTransaction(db, 1000, 'A');
    const outbox = db
      .prepare(`SELECT row_key FROM sync_outbox WHERE table_name = 'transactions'`)
      .all();
    expect(outbox).toHaveLength(0);
    db.exec(`UPDATE sync_meta SET value = '0' WHERE key = 'pull_in_progress'`);
    insertTransaction(db, 2000, 'B');
    expect(
      db
        .prepare(`SELECT row_key FROM sync_outbox WHERE table_name = 'transactions'`)
        .all()
    ).toHaveLength(1);
  });

  it('logs a tombstone with the uuid as row_key on delete', () => {
    const db = freshDb();
    db.exec(
      `INSERT INTO months (month_key, allowance_cents, starting_reserve_cents)
       VALUES ('2026-09', 100000, 0)`
    );
    insertTransaction(db, 1000, 'A');
    const tx = db
      .prepare('SELECT id, uuid FROM transactions')
      .get() as { id: number; uuid: string };
    db.exec(`DELETE FROM transactions WHERE id = ${tx.id}`);
    const tombstone = db
      .prepare(
        `SELECT table_name, row_key FROM sync_tombstones WHERE table_name = 'transactions'`
      )
      .get() as { table_name: string; row_key: string };
    expect(tombstone).toBeDefined();
    expect(tombstone.row_key).toBe(tx.uuid);
  });

  it('migration 9 rebuilds broken triggers from an early registry (UNIQUE regression)', () => {
    const db = freshWithoutMigration9();
    db.exec(
      `INSERT INTO months (month_key, allowance_cents, starting_reserve_cents)
       VALUES ('2026-09', 100000, 0)`
    );
    db.exec(`
DROP TRIGGER IF EXISTS trg_transactions_ai;
CREATE TRIGGER trg_transactions_ai AFTER INSERT ON transactions
WHEN (SELECT COALESCE((SELECT value FROM sync_meta WHERE key = 'pull_in_progress'), '0') = '0')
BEGIN
  INSERT INTO sync_outbox (table_name, row_key) VALUES ('transactions', NEW.month_key);
END;
`);
    insertTransaction(db, 1000, 'A');
    expect(() => insertTransaction(db, 2000, 'B')).toThrow(/UNIQUE/i);

    applyMigrations(db, 9, 9);
    expect(() => {
      insertTransaction(db, 3000, 'C');
      insertTransaction(db, 4000, 'D');
    }).not.toThrow();
    const fresh = db
      .prepare(`SELECT id, uuid FROM transactions ORDER BY id DESC LIMIT 1`)
      .get() as { uuid: string };
    const outboxRows = db
      .prepare(`SELECT row_key FROM sync_outbox WHERE table_name = 'transactions'`)
      .all() as Array<{ row_key: string }>;
    expect(outboxRows.some((row) => row.row_key === fresh.uuid)).toBe(true);
  });
});

function freshWithoutMigration9(): DatabaseSync {
  const db = new DatabaseSync(':memory:');
  applyMigrations(db, 1, 8);
  return db;
}

function createSpace(db: DatabaseSync, name: string): number {
  db.exec(`INSERT INTO shared_spaces (name, owner_user_id) VALUES ('${name}', 'user-1')`);
  const row = db
    .prepare('SELECT id FROM shared_spaces ORDER BY id DESC LIMIT 1')
    .get() as { id: number };
  db.exec(
    `INSERT INTO shared_space_members (space_id, user_id, email, role, status, joined_at)
     VALUES (${row.id}, 'user-1', 'owner@example.com', 'owner', 'active', '2026-09-01T00:00:00.000Z')`
  );
  return row.id;
}

describe('shared-space change-capture triggers (migration 10)', () => {
  it('creates shared tables and assigns uuids', () => {
    const db = freshDb();
    const spaceId = createSpace(db, 'Home');
    const space = db
      .prepare('SELECT id, uuid, updated_at FROM shared_spaces WHERE id = ?')
      .get(spaceId) as { id: number; uuid: string | null; updated_at: string | null };
    expect(space.uuid).toBeTruthy();
    expect(space.updated_at).toBeTruthy();
  });

  it('logs a new space and member to the outbox keyed by uuid', () => {
    const db = freshDb();
    createSpace(db, 'Home');
    const outbox = db
      .prepare(
        `SELECT table_name, row_key FROM sync_outbox
          WHERE table_name IN ('shared_spaces', 'shared_space_members')
          ORDER BY table_name`
      )
      .all() as Array<{ table_name: string; row_key: string }>;
    expect(outbox).toHaveLength(2);
    for (const row of outbox) {
      expect(row.row_key).toBeTruthy();
    }
  });

  it('logs an expense and its splits', () => {
    const db = freshDb();
    const spaceId = createSpace(db, 'Home');
    db.exec(
      `INSERT INTO shared_periods (space_id, start_date, status) VALUES (${spaceId}, '2026-09-01', 'open')`
    );
    const period = db
      .prepare('SELECT id FROM shared_periods ORDER BY id DESC LIMIT 1')
      .get() as { id: number };
    const member = db
      .prepare('SELECT id FROM shared_space_members ORDER BY id LIMIT 1')
      .get() as { id: number };
    db.exec(
      `INSERT INTO shared_expenses
         (space_id, period_id, description, total_amount_cents, date, paid_by_member_id)
       VALUES (${spaceId}, ${period.id}, 'Rent', 100000, '2026-09-02', ${member.id})`
    );
    const expense = db
      .prepare('SELECT id FROM shared_expenses ORDER BY id DESC LIMIT 1')
      .get() as { id: number };
    db.exec(
      `INSERT INTO shared_expense_splits (expense_id, member_id, amount_cents)
       VALUES (${expense.id}, ${member.id}, 100000)`
    );
    const outbox = db
      .prepare(
        `SELECT row_key FROM sync_outbox
          WHERE table_name IN ('shared_expenses', 'shared_expense_splits')`
      )
      .all() as Array<{ row_key: string }>;
    expect(outbox).toHaveLength(2);
  });

  it('logs a tombstone with the uuid on delete', () => {
    const db = freshDb();
    createSpace(db, 'Home');
    const space = db
      .prepare('SELECT id, uuid FROM shared_spaces ORDER BY id LIMIT 1')
      .get() as { id: number; uuid: string };
    db.exec(`DELETE FROM shared_spaces WHERE id = ${space.id}`);
    const tombstone = db
      .prepare(
        `SELECT table_name, row_key, space_uuid FROM shared_sync_tombstones WHERE table_name = 'shared_spaces'`
      )
      .get() as { table_name: string; row_key: string; space_uuid: string | null };
    expect(tombstone).toBeDefined();
    expect(tombstone.row_key).toBe(space.uuid);
    expect(tombstone.space_uuid).toBe(space.uuid);
  });

  it('does not log shared changes while a pull is in progress', () => {
    const db = freshDb();
    db.exec(`INSERT INTO sync_meta (key, value) VALUES ('pull_in_progress', '1')`);
    createSpace(db, 'Home');
    const outbox = db
      .prepare(
        `SELECT row_key FROM sync_outbox
          WHERE table_name IN ('shared_spaces', 'shared_space_members')`
      )
      .all();
    expect(outbox).toHaveLength(0);
  });
});

describe('migration 11 and schema self-heal (sync_state.last_sync_error)', () => {
  function syncStateColumns(db: DatabaseSync): string[] {
    const cols = db.prepare('PRAGMA table_info(sync_state)').all() as Array<{ name: string }>;
    return cols.map((c) => c.name);
  }

  it('migration 11 adds last_sync_error when migrating a fresh database', () => {
    const db = new DatabaseSync(':memory:');
    applyMigrations(db, 1, 11);
    const columns = syncStateColumns(db);
    expect(columns).toContain('last_sync_error');
    const row = db
      .prepare('INSERT INTO sync_state (id, enabled, last_sync_error) VALUES (1, 0, \'oops\')')
      .run();
    expect(row).toBeDefined();
  });

  it('the guard-based repair adds the missing column without throwing on rerun', () => {
    const db = freshDb();
    expect(syncStateColumns(db)).not.toContain('last_sync_error');

    const columns = db.prepare('PRAGMA table_info(sync_state)').all() as Array<{ name: string }>;
    expect(() => {
      if (columns.length > 0 && !columns.some((c) => c.name === 'last_sync_error')) {
        db.exec('ALTER TABLE sync_state ADD COLUMN last_sync_error TEXT;');
      }
    }).not.toThrow();
    expect(syncStateColumns(db)).toContain('last_sync_error');

    expect(() => db.exec('ALTER TABLE sync_state ADD COLUMN last_sync_error TEXT;')).toThrow(
      /duplicate/i
    );
  });
});