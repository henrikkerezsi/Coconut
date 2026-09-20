/// <reference types="node" />

import { DatabaseSync } from 'node:sqlite';
import { MIGRATIONS } from '../../src/database/migrations';
import {
  getCheckForUpdatesOnStart,
  getIgnoredReleaseVersion,
  setCheckForUpdatesOnStart,
  setIgnoredReleaseVersion,
} from '../../src/database/updatePrefs';

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

function freshDb(): DatabaseSync {
  const db = new DatabaseSync(':memory:');
  for (const migration of MIGRATIONS.sort((a, b) => a.id - b.id)) {
    db.exec(migration.sql);
  }
  return db;
}

describe('update preferences', () => {
  it('defaults the startup update check to off', async () => {
    const raw = freshDb();
    await expect(getCheckForUpdatesOnStart(makeDbApi(raw) as never)).resolves.toBe(false);
  });

  it('persists and reads back the startup update check', async () => {
    const raw = freshDb();
    await setCheckForUpdatesOnStart(true, makeDbApi(raw) as never);
    await expect(getCheckForUpdatesOnStart(makeDbApi(raw) as never)).resolves.toBe(true);
    await setCheckForUpdatesOnStart(false, makeDbApi(raw) as never);
    await expect(getCheckForUpdatesOnStart(makeDbApi(raw) as never)).resolves.toBe(false);
  });

  it('keeps the ignored release version independent of the update-check toggle', async () => {
    const raw = freshDb();
    await setIgnoredReleaseVersion('v1.2.3', makeDbApi(raw) as never);
    await setCheckForUpdatesOnStart(true, makeDbApi(raw) as never);
    await expect(getIgnoredReleaseVersion(makeDbApi(raw) as never)).resolves.toBe('v1.2.3');
    await expect(getCheckForUpdatesOnStart(makeDbApi(raw) as never)).resolves.toBe(true);
  });
});