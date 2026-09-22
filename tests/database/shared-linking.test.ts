/// <reference types="node" />

import { DatabaseSync } from 'node:sqlite';
import { MIGRATIONS } from '../../src/database/migrations';
import { decoupleSharedTransactions, reconcileSharedTransactions } from '../../src/database/sharedLinking';
import { getTransaction, updateTransactionAttachment, updateTransactionBudget } from '../../src/database/transactions';

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

interface Fixture {
  spaceId: number;
  periodId: number;
  memberOne: number;
  memberTwo: number;
}

function seedSpace(db: DatabaseSync): Fixture {
  db.exec(`INSERT INTO shared_spaces (name, owner_user_id) VALUES ('Home', 'user-1')`);
  const spaceId = (
    db.prepare('SELECT id FROM shared_spaces').get() as { id: number }
  ).id;
  db.exec(
    `INSERT INTO shared_space_members (space_id, user_id, email, role, status, joined_at)
     VALUES (${spaceId}, 'user-1', 'one@example.com', 'owner', 'active', '2026-09-01T00:00:00.000Z')`
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

function addExpense(
  db: DatabaseSync,
  fixture: Fixture,
  totalCents: number,
  splitOne: number,
  splitTwo: number
): { expenseId: number; uuid: string } {
  db.exec(
    `INSERT INTO shared_expenses
       (space_id, period_id, description, total_amount_cents, date, paid_by_member_id, created_by_user_id)
     VALUES (${fixture.spaceId}, ${fixture.periodId}, 'Dinner', ${totalCents}, '2026-09-10', ${fixture.memberOne}, 'user-1')`
  );
  const expenseId = (
    db.prepare('SELECT id FROM shared_expenses ORDER BY id DESC LIMIT 1').get() as { id: number }
  ).id;
  const uuid = (
    db.prepare('SELECT uuid FROM shared_expenses WHERE id = ?').get(expenseId) as { uuid: string }
  ).uuid;
  db.exec(
    `INSERT INTO shared_expense_splits (expense_id, member_id, amount_cents)
     VALUES (${expenseId}, ${fixture.memberOne}, ${splitOne}),
            (${expenseId}, ${fixture.memberTwo}, ${splitTwo})`
  );
  return { expenseId, uuid };
}

function linkedTransactions(db: DatabaseSync): Array<{
  id: number;
  amount_cents: number;
  origin_type: string | null;
  origin_id: string | null;
  merchant: string;
  budget_id: number | null;
}> {
  return db
    .prepare(
      `SELECT id, amount_cents, origin_type, origin_id, merchant, budget_id
         FROM transactions ORDER BY id ASC`
    )
    .all() as Array<{
    id: number;
    amount_cents: number;
    origin_type: string | null;
    origin_id: string | null;
    merchant: string;
    budget_id: number | null;
  }>;
}

describe('reconcileSharedTransactions', () => {
  it('creates one linked transaction for the signed-in member share', async () => {
    const raw = freshDb();
    const fixture = seedSpace(raw);
    const { uuid } = addExpense(raw, fixture, 10000, 4000, 6000);

    await reconcileSharedTransactions('user-1', makeDbApi(raw) as never);

    const linked = linkedTransactions(raw);
    expect(linked).toHaveLength(1);
    expect(linked[0].origin_type).toBe('shared');
    expect(linked[0].origin_id).toBe(uuid);
    expect(linked[0].amount_cents).toBe(4000);
    expect(linked[0].merchant).toBe('Dinner');
  });

  it('re-derives the linked amount when the split changes', async () => {
    const raw = freshDb();
    const fixture = seedSpace(raw);
    const { expenseId } = addExpense(raw, fixture, 10000, 4000, 6000);
    await reconcileSharedTransactions('user-1', makeDbApi(raw) as never);

    raw.exec(
      `UPDATE shared_expense_splits SET amount_cents = 2500
        WHERE expense_id = ${expenseId} AND member_id = ${fixture.memberOne}`
    );
    await reconcileSharedTransactions('user-1', makeDbApi(raw) as never);

    const linked = linkedTransactions(raw);
    expect(linked).toHaveLength(1);
    expect(linked[0].amount_cents).toBe(2500);
  });

  it('removes linked transactions when the expense is deleted', async () => {
    const raw = freshDb();
    const fixture = seedSpace(raw);
    const { expenseId } = addExpense(raw, fixture, 10000, 4000, 6000);
    await reconcileSharedTransactions('user-1', makeDbApi(raw) as never);

    raw.exec(`DELETE FROM shared_expense_splits WHERE expense_id = ${expenseId}`);
    raw.exec(`DELETE FROM shared_expenses WHERE id = ${expenseId}`);
    await reconcileSharedTransactions('user-1', makeDbApi(raw) as never);

    expect(linkedTransactions(raw)).toHaveLength(0);
  });

  it('ignores expenses for spaces the user only has a pending invite to', async () => {
    const raw = freshDb();
    const fixture = seedSpace(raw);
    raw.exec(
      `UPDATE shared_space_members SET status = 'pending', user_id = NULL
        WHERE id = ${fixture.memberOne}`
    );
    addExpense(raw, fixture, 10000, 4000, 6000);

    await reconcileSharedTransactions('user-1', makeDbApi(raw) as never);

    expect(linkedTransactions(raw)).toHaveLength(0);
  });
});

describe('reconcileSharedTransactions with local attachments', () => {
  const bytes = new Uint8Array([7, 8, 9]);

  it('keeps a locally-attached file when the linked transaction is re-derived', async () => {
    const raw = freshDb();
    const fixture = seedSpace(raw);
    const { uuid } = addExpense(raw, fixture, 10000, 4000, 6000);
    await reconcileSharedTransactions('user-1', makeDbApi(raw) as never);

    const linked = linkedTransactions(raw);
    expect(linked).toHaveLength(1);
    await updateTransactionAttachment(
      linked[0].id,
      { name: 'receipt.png', mime: 'image/png', bytes },
      makeDbApi(raw) as never
    );

    await reconcileSharedTransactions('user-1', makeDbApi(raw) as never);

    const kept = await getTransaction(linked[0].id, makeDbApi(raw) as never);
    expect(kept?.attachmentName).toBe('receipt.png');
    expect(kept?.attachmentMime).toBe('image/png');
    expect(Array.from(kept?.attachment ?? new Uint8Array())).toEqual(Array.from(bytes));
  });

  it('re-derives the amount while preserving the local attachment', async () => {
    const raw = freshDb();
    const fixture = seedSpace(raw);
    const { expenseId } = addExpense(raw, fixture, 10000, 4000, 6000);
    await reconcileSharedTransactions('user-1', makeDbApi(raw) as never);

    const linked = linkedTransactions(raw);
    await updateTransactionAttachment(
      linked[0].id,
      { name: 'receipt.png', mime: 'image/png', bytes },
      makeDbApi(raw) as never
    );

    raw.exec(
      `UPDATE shared_expense_splits SET amount_cents = 2500
        WHERE expense_id = ${expenseId} AND member_id = ${fixture.memberOne}`
    );
    await reconcileSharedTransactions('user-1', makeDbApi(raw) as never);

    const rederived = await getTransaction(linked[0].id, makeDbApi(raw) as never);
    expect(rederived?.amountCents).toBe(2500);
    expect(rederived?.attachmentName).toBe('receipt.png');
    expect(Array.from(rederived?.attachment ?? new Uint8Array())).toEqual(Array.from(bytes));
  });

  it('updating the attachment to null clears it on the linked transaction', async () => {
    const raw = freshDb();
    const fixture = seedSpace(raw);
    const { uuid } = addExpense(raw, fixture, 10000, 4000, 6000);
    await reconcileSharedTransactions('user-1', makeDbApi(raw) as never);

    const linked = linkedTransactions(raw);
    await updateTransactionAttachment(
      linked[0].id,
      { name: 'receipt.png', mime: 'image/png', bytes },
      makeDbApi(raw) as never
    );
    await updateTransactionAttachment(linked[0].id, null, makeDbApi(raw) as never);

    const cleared = await getTransaction(linked[0].id, makeDbApi(raw) as never);
    expect(cleared?.attachmentName).toBeNull();
    expect(cleared?.attachmentMime).toBeNull();
    expect(cleared?.attachment).toBeNull();
  });
});

describe('decoupleSharedTransactions', () => {
  it('clears the link but keeps the personal transaction', async () => {
    const raw = freshDb();
    const fixture = seedSpace(raw);
    const { uuid } = addExpense(raw, fixture, 10000, 4000, 6000);
    await reconcileSharedTransactions('user-1', makeDbApi(raw) as never);
    expect(linkedTransactions(raw)).toHaveLength(1);

    const changes = await decoupleSharedTransactions([uuid], makeDbApi(raw) as never);

    expect(changes).toBe(1);
    const kept = linkedTransactions(raw);
    expect(kept).toHaveLength(1);
    expect(kept[0].amount_cents).toBe(4000);
    expect(kept[0].merchant).toBe('Dinner');
    expect(kept[0].origin_type).toBeNull();
    expect(kept[0].origin_id).toBeNull();
  });

  it('is a no-op for an empty list', async () => {
    const raw = freshDb();
    const changes = await decoupleSharedTransactions([], makeDbApi(raw) as never);
    expect(changes).toBe(0);
  });
});

describe('mirror budget assignment', () => {
  function seedBudget(db: DatabaseSync, name: string): number {
    db.exec(`INSERT INTO budgets (name, default_amount_cents) VALUES ('${name}', 50000)`);
    return (db.prepare('SELECT id FROM budgets WHERE name = ?').get(name) as { id: number }).id;
  }

  function addPersonalTransaction(
    db: DatabaseSync,
    merchant: string,
    budgetId: number | null,
    date: string
  ): void {
    db.exec(
      `INSERT OR IGNORE INTO months (month_key, allowance_cents, starting_reserve_cents)
       VALUES ('2026-09', 100000, 0)`
    );
    db.exec(
      `INSERT INTO transactions (month_key, date, amount_cents, budget_id, merchant)
       VALUES ('2026-09', '${date}', 1000, ${budgetId === null ? 'NULL' : budgetId}, '${merchant}')`
    );
  }

  it('assigns the budget of the newest same-name transaction on first mirror', async () => {
    const raw = freshDb();
    const fixture = seedSpace(raw);
    const olderBudget = seedBudget(raw, 'Eating out');
    const newestBudget = seedBudget(raw, 'Groceries');
    addPersonalTransaction(raw, 'Dinner', olderBudget, '2026-09-01');
    addPersonalTransaction(raw, 'Dinner', newestBudget, '2026-09-20');
    addExpense(raw, fixture, 10000, 4000, 6000);

    await reconcileSharedTransactions('user-1', makeDbApi(raw) as never);

    const mirror = linkedTransactions(raw).find((row) => row.origin_type === 'shared');
    expect(mirror?.merchant).toBe('Dinner');
    expect(mirror?.budget_id).toBe(newestBudget);
  });

  it('leaves the mirror without a budget when no same-name transaction exists', async () => {
    const raw = freshDb();
    const fixture = seedSpace(raw);
    addExpense(raw, fixture, 10000, 4000, 6000);

    await reconcileSharedTransactions('user-1', makeDbApi(raw) as never);

    const linked = linkedTransactions(raw);
    expect(linked).toHaveLength(1);
    expect(linked[0].budget_id).toBeNull();
  });

  it('does not re-run the budget lookup when the mirror is re-derived', async () => {
    const raw = freshDb();
    const fixture = seedSpace(raw);
    const initialBudget = seedBudget(raw, 'Groceries');
    const changedBudget = seedBudget(raw, 'Eating out');
    addPersonalTransaction(raw, 'Dinner', initialBudget, '2026-09-20');
    const { expenseId } = addExpense(raw, fixture, 10000, 4000, 6000);
    await reconcileSharedTransactions('user-1', makeDbApi(raw) as never);
    expect(linkedTransactions(raw).find((row) => row.origin_type === 'shared')?.budget_id).toBe(
      initialBudget
    );

    addPersonalTransaction(raw, 'Dinner', changedBudget, '2026-09-25');
    raw.exec(
      `UPDATE shared_expense_splits SET amount_cents = 2500
        WHERE expense_id = ${expenseId} AND member_id = ${fixture.memberOne}`
    );
    await reconcileSharedTransactions('user-1', makeDbApi(raw) as never);

    const mirror = linkedTransactions(raw).find((row) => row.origin_type === 'shared');
    expect(mirror?.amount_cents).toBe(2500);
    expect(mirror?.budget_id).toBe(initialBudget);
  });

  it('preserves a manually-chosen budget across re-derives', async () => {
    const raw = freshDb();
    const fixture = seedSpace(raw);
    const chosen = seedBudget(raw, 'Groceries');
    const { expenseId } = addExpense(raw, fixture, 10000, 4000, 6000);
    await reconcileSharedTransactions('user-1', makeDbApi(raw) as never);
    expect(linkedTransactions(raw)[0].budget_id).toBeNull();

    const mirror = linkedTransactions(raw)[0];
    await updateTransactionBudget(mirror.id, chosen, makeDbApi(raw) as never);

    raw.exec(
      `UPDATE shared_expense_splits SET amount_cents = 2500
        WHERE expense_id = ${expenseId} AND member_id = ${fixture.memberOne}`
    );
    await reconcileSharedTransactions('user-1', makeDbApi(raw) as never);

    const rederived = linkedTransactions(raw);
    expect(rederived).toHaveLength(1);
    expect(rederived[0].amount_cents).toBe(2500);
    expect(rederived[0].budget_id).toBe(chosen);
  });
});
