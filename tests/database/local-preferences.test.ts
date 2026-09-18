/// <reference types="node" />

import { DatabaseSync } from 'node:sqlite';
import { MIGRATIONS } from '../../src/database/migrations';
import {
  getSelectedSpaceUuid,
  setSelectedSpaceUuid,
} from '../../src/database/localPreferences';

interface TestDb {
  getFirstAsync<T>(sql: string, params?: unknown[]): Promise<T | null>;
  runAsync(sql: string, params?: unknown[]): Promise<unknown>;
}

type SqlParams = Parameters<ReturnType<DatabaseSync['prepare']>['get']>;

function makeDbApi(raw: DatabaseSync): TestDb {
  return {
    getFirstAsync<T>(sql: string, params: unknown[] = []): Promise<T | null> {
      const row = raw.prepare(sql).get(...(params as SqlParams));
      return Promise.resolve((row as T | undefined) ?? null);
    },
    runAsync(sql: string, params: unknown[] = []): Promise<unknown> {
      raw.prepare(sql).run(...(params as SqlParams));
      return Promise.resolve(null);
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

describe('selected shared space preference', () => {
  it('returns null when nothing has been stored', async () => {
    const raw = freshDb();
    await expect(getSelectedSpaceUuid(makeDbApi(raw) as never)).resolves.toBeNull();
  });

  it('persists and reads back the selected space uuid', async () => {
    const raw = freshDb();
    await setSelectedSpaceUuid('space-uuid-1', makeDbApi(raw) as never);
    await expect(getSelectedSpaceUuid(makeDbApi(raw) as never)).resolves.toBe('space-uuid-1');
  });

  it('overwrites the previous selection', async () => {
    const raw = freshDb();
    await setSelectedSpaceUuid('space-uuid-1', makeDbApi(raw) as never);
    await setSelectedSpaceUuid('space-uuid-2', makeDbApi(raw) as never);
    await expect(getSelectedSpaceUuid(makeDbApi(raw) as never)).resolves.toBe('space-uuid-2');
  });

  it('clears the preference when set to null', async () => {
    const raw = freshDb();
    await setSelectedSpaceUuid('space-uuid-1', makeDbApi(raw) as never);
    await setSelectedSpaceUuid(null, makeDbApi(raw) as never);
    await expect(getSelectedSpaceUuid(makeDbApi(raw) as never)).resolves.toBeNull();
  });
});
