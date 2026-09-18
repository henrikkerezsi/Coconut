/// <reference types="node" />

import { DatabaseSync } from 'node:sqlite';
import { MIGRATIONS } from '../../src/database/migrations';
import {
  createSharedSpace,
  getMemberForUser,
  getSpaceMembers,
  setMemberDisplayNameForUser,
} from '../../src/database/sharedSpaces';

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