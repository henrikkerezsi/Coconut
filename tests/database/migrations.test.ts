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
  applyMigrations(db, 1, 9);
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