/// <reference types="node" />

import { DatabaseSync } from 'node:sqlite';
import { MIGRATIONS } from '../../src/database/migrations';
import {
  createSharedSpace,
  deleteSharedSpace,
  getMemberForUser,
  getMySharedSpaces,
  getSpaceMembers,
  removeSpaceMember,
  renameSharedSpace,
  setMemberDisplayNameForUser,
} from '../../src/database/sharedSpaces';
import { reconcileSharedTransactions } from '../../src/database/sharedLinking';

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

describe('shared space display names', () => {
  it('stores the owner display name when a space is created', async () => {
    const raw = freshDb();
    const api = makeDbApi(raw) as never;
    const spaceId = await createSharedSpace(
      { name: 'Flat', ownerUserId: 'user-1', ownerEmail: 'one@example.com', ownerDisplayName: 'alice' },
      api
    );
    const owner = await getMemberForUser(spaceId, 'user-1', api);
    expect(owner?.displayName).toBe('alice');
  });

  it('stores only the email when no owner display name is given', async () => {
    const raw = freshDb();
    const api = makeDbApi(raw) as never;
    const spaceId = await createSharedSpace(
      { name: 'Flat', ownerUserId: 'user-1', ownerEmail: 'one@example.com', ownerDisplayName: null },
      api
    );
    const owner = await getMemberForUser(spaceId, 'user-1', api);
    expect(owner?.displayName).toBeNull();
  });

  it('updates the display name for the user across all their memberships', async () => {
    const raw = freshDb();
    const api = makeDbApi(raw) as never;
    const first = await createSharedSpace(
      { name: 'Flat', ownerUserId: 'user-1', ownerEmail: 'one@example.com', ownerDisplayName: 'alice' },
      api
    );
    const second = await createSharedSpace(
      { name: 'Cabin', ownerUserId: 'user-2', ownerEmail: 'two@example.com', ownerDisplayName: null },
      api
    );
    await setMemberDisplayNameForUser('user-1', 'alice-two', api);
    await expect(getMemberForUser(first, 'user-1', api).then((m) => m?.displayName)).resolves.toBe(
      'alice-two'
    );
    await expect(getMemberForUser(second, 'user-2', api).then((m) => m?.displayName)).resolves.toBeNull();
  });

  it('clears the display name when set to null', async () => {
    const raw = freshDb();
    const api = makeDbApi(raw) as never;
    const spaceId = await createSharedSpace(
      { name: 'Flat', ownerUserId: 'user-1', ownerEmail: 'one@example.com', ownerDisplayName: 'alice' },
      api
    );
    await setMemberDisplayNameForUser('user-1', null, api);
    await expect(getMemberForUser(spaceId, 'user-1', api).then((m) => m?.displayName)).resolves.toBeNull();
  });

  it('leaves other members untouched', async () => {
    const raw = freshDb();
    const api = makeDbApi(raw) as never;
    const spaceId = await createSharedSpace(
      { name: 'Flat', ownerUserId: 'user-1', ownerEmail: 'one@example.com', ownerDisplayName: 'alice' },
      api
    );
    raw.exec(`INSERT INTO shared_space_members (space_id, user_id, email, role, status, joined_at)
              VALUES (${spaceId}, 'user-2', 'two@example.com', 'member', 'active', strftime('%Y-%m-%dT%H:%M:%fZ','now'))`);
    await setMemberDisplayNameForUser('user-2', 'bob', api);
    const members = await getSpaceMembers(spaceId, api);
    expect(members.find((m) => m.userId === 'user-1')?.displayName).toBe('alice');
    expect(members.find((m) => m.userId === 'user-2')?.displayName).toBe('bob');
  });
});

describe('renameSharedSpace', () => {
  it('updates the space name', async () => {
    const raw = freshDb();
    const api = makeDbApi(raw) as never;
    const spaceId = await createSharedSpace(
      { name: 'Flat', ownerUserId: 'user-1', ownerEmail: 'one@example.com', ownerDisplayName: null },
      api
    );
    await renameSharedSpace(spaceId, '  Cabin  ', api);
    const space = raw.prepare('SELECT name FROM shared_spaces WHERE id = ?').get(spaceId) as {
      name: string;
    };
    expect(space.name).toBe('Cabin');
  });
});

describe('removeSpaceMember', () => {
  it('marks a member as left and hides them from getSpaceMembers', async () => {
    const raw = freshDb();
    const api = makeDbApi(raw) as never;
    const spaceId = await createSharedSpace(
      { name: 'Flat', ownerUserId: 'user-1', ownerEmail: 'one@example.com', ownerDisplayName: null },
      api
    );
    raw.exec(`INSERT INTO shared_space_members (space_id, user_id, email, role, status, joined_at)
              VALUES (${spaceId}, 'user-2', 'two@example.com', 'member', 'active', strftime('%Y-%m-%dT%H:%M:%fZ','now'))`);
    const memberId = (raw.prepare('SELECT id FROM shared_space_members WHERE user_id = ?').get('user-2') as { id: number }).id;

    await removeSpaceMember(memberId, api);

    const member = raw.prepare('SELECT status FROM shared_space_members WHERE id = ?').get(memberId) as {
      status: string;
    };
    expect(member.status).toBe('left');
    const visible = await getSpaceMembers(spaceId, api);
    expect(visible.find((m) => m.id === memberId)).toBeUndefined();
  });

  it('refuses to remove the owner', async () => {
    const raw = freshDb();
    const api = makeDbApi(raw) as never;
    const spaceId = await createSharedSpace(
      { name: 'Flat', ownerUserId: 'user-1', ownerEmail: 'one@example.com', ownerDisplayName: null },
      api
    );
    const ownerId = (raw.prepare('SELECT id FROM shared_space_members WHERE role = ?').get('owner') as { id: number }).id;

    await removeSpaceMember(ownerId, api);

    const member = raw.prepare('SELECT status FROM shared_space_members WHERE id = ?').get(ownerId) as {
      status: string;
    };
    expect(member.status).toBe('active');
  });
});

describe('getMySharedSpaces', () => {
  it('returns only spaces where the user is an active member', async () => {
    const raw = freshDb();
    const api = makeDbApi(raw) as never;
    const mine = await createSharedSpace(
      { name: 'Flat', ownerUserId: 'user-1', ownerEmail: 'one@example.com', ownerDisplayName: 'alice' },
      api
    );
    const theirs = await createSharedSpace(
      { name: 'Cabin', ownerUserId: 'user-2', ownerEmail: 'two@example.com', ownerDisplayName: null },
      api
    );
    const third = await createSharedSpace(
      { name: 'Garage', ownerUserId: 'user-3', ownerEmail: 'three@example.com', ownerDisplayName: null },
      api
    );
    raw.exec(`INSERT INTO shared_space_members (space_id, user_id, email, role, status, joined_at)
              VALUES (${theirs}, 'user-1', 'one@example.com', 'member', 'active', strftime('%Y-%m-%dT%H:%M:%fZ','now'))`);

    const spaces = await getMySharedSpaces('user-1', api);

    expect(spaces.map((space) => space.name)).toEqual(['Flat', 'Cabin']);
    expect(spaces.some((space) => space.name === 'Garage')).toBe(false);
  });

  it('hides spaces where the user has left or is still pending', async () => {
    const raw = freshDb();
    const api = makeDbApi(raw) as never;
    const left = await createSharedSpace(
      { name: 'Left', ownerUserId: 'user-2', ownerEmail: 'two@example.com', ownerDisplayName: null },
      api
    );
    const pending = await createSharedSpace(
      { name: 'Pending', ownerUserId: 'user-3', ownerEmail: 'three@example.com', ownerDisplayName: null },
      api
    );
    raw.exec(`INSERT INTO shared_space_members (space_id, user_id, email, role, status, joined_at)
              VALUES (${left}, 'user-1', 'one@example.com', 'member', 'left', strftime('%Y-%m-%dT%H:%M:%fZ','now'))`);
    raw.exec(`INSERT INTO shared_space_members (space_id, user_id, email, role, status, joined_at)
              VALUES (${pending}, 'user-1', 'one@example.com', 'member', 'pending', strftime('%Y-%m-%dT%H:%M:%fZ','now'))`);

    const spaces = await getMySharedSpaces('user-1', api);

    expect(spaces).toEqual([]);
  });
});

describe('deleteSharedSpace', () => {
  it('removes the space, its children, and keeps linked transactions as ordinary ones', async () => {
    const raw = freshDb();
    const api = makeDbApi(raw) as never;
    const spaceId = await createSharedSpace(
      { name: 'Flat', ownerUserId: 'user-1', ownerEmail: 'one@example.com', ownerDisplayName: 'alice' },
      api
    );
    const memberOne = (raw.prepare('SELECT id FROM shared_space_members ORDER BY id LIMIT 1').get() as { id: number }).id;
    raw.exec(`INSERT INTO shared_space_members (space_id, user_id, email, role, status, joined_at)
              VALUES (${spaceId}, 'user-2', 'two@example.com', 'member', 'active', strftime('%Y-%m-%dT%H:%M:%fZ','now'))`);
    const memberTwo = (raw.prepare('SELECT id FROM shared_space_members ORDER BY id DESC LIMIT 1').get() as { id: number }).id;
    raw.exec(`INSERT INTO shared_periods (space_id, start_date, status)
              VALUES (${spaceId}, '2026-09-01', 'open')`);
    const periodId = (raw.prepare('SELECT id FROM shared_periods ORDER BY id DESC LIMIT 1').get() as { id: number }).id;
    raw.exec(
      `INSERT INTO shared_expenses (space_id, period_id, description, total_amount_cents, date, paid_by_member_id, created_by_user_id)
       VALUES (${spaceId}, ${periodId}, 'Dinner', 10000, '2026-09-10', ${memberOne}, 'user-1')`
    );
    const expenseId = (raw.prepare('SELECT id FROM shared_expenses ORDER BY id DESC LIMIT 1').get() as { id: number }).id;
    raw.exec(
      `INSERT INTO shared_expense_splits (expense_id, member_id, amount_cents)
       VALUES (${expenseId}, ${memberOne}, 4000), (${expenseId}, ${memberTwo}, 6000)`
    );
    await reconcileSharedTransactions('user-1', api);
    const linkedBefore = raw.prepare('SELECT origin_type, origin_id FROM transactions').all() as Array<{
      origin_type: string;
      origin_id: string;
    }>;
    expect(linkedBefore).toHaveLength(1);

    await deleteSharedSpace(spaceId, api);

    expect((raw.prepare('SELECT COUNT(*) AS n FROM shared_spaces').get() as { n: number }).n).toBe(0);
    expect((raw.prepare('SELECT COUNT(*) AS n FROM shared_expenses').get() as { n: number }).n).toBe(0);
    expect((raw.prepare('SELECT COUNT(*) AS n FROM shared_expense_splits').get() as { n: number }).n).toBe(0);
    expect((raw.prepare('SELECT COUNT(*) AS n FROM shared_space_members').get() as { n: number }).n).toBe(0);
    expect((raw.prepare('SELECT COUNT(*) AS n FROM shared_periods').get() as { n: number }).n).toBe(0);

    const kept = raw.prepare('SELECT amount_cents, merchant, origin_type, origin_id FROM transactions').all() as Array<{
      amount_cents: number;
      merchant: string;
      origin_type: string | null;
      origin_id: string | null;
    }>;
    expect(kept).toHaveLength(1);
    expect(kept[0].amount_cents).toBe(4000);
    expect(kept[0].merchant).toBe('Dinner');
    expect(kept[0].origin_type).toBeNull();
    expect(kept[0].origin_id).toBeNull();

    const tombstones = raw
      .prepare('SELECT table_name, row_key FROM shared_sync_tombstones')
      .all() as Array<{ table_name: string; row_key: string }>;
    expect(tombstones).toHaveLength(1);
    expect(tombstones[0].table_name).toBe('shared_spaces');
    expect(tombstones[0].row_key).toBeTruthy();
  });

  it('leaves a tombstone for a brand-new space that was never pushed so it can be pruned remotely', async () => {
    const raw = freshDb();
    const api = makeDbApi(raw) as never;
    raw.exec(`INSERT INTO shared_spaces (name, owner_user_id) VALUES ('LocalOnly', 'user-1')`);
    const space = raw.prepare('SELECT id, uuid FROM shared_spaces').get() as {
      id: number;
      uuid: string | null;
    };
    expect(space.uuid).toBeTruthy();

    await deleteSharedSpace(space.id, api);

    expect((raw.prepare('SELECT COUNT(*) AS n FROM shared_spaces').get() as { n: number }).n).toBe(0);
    const tombstones = raw
      .prepare('SELECT table_name, row_key, space_uuid FROM shared_sync_tombstones')
      .all() as Array<{ table_name: string; row_key: string; space_uuid: string }>;
    expect(tombstones).toHaveLength(1);
    expect(tombstones[0].table_name).toBe('shared_spaces');
    expect(tombstones[0].row_key).toBe(space.uuid);
    expect(tombstones[0].space_uuid).toBe(space.uuid);
  });
});