/// <reference types="node" />

import { DatabaseSync } from 'node:sqlite';
import { MIGRATIONS } from '../../src/database/migrations';
import { getSettings, updateSettings } from '../../src/database/settings';

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

describe('settings username', () => {
  it('defaults to null when nothing has been stored', async () => {
    const raw = freshDb();
    const settings = await getSettings(makeDbApi(raw) as never);
    expect(settings.username).toBeNull();
  });

  it('persists and reads back a username', async () => {
    const raw = freshDb();
    await updateSettings({ username: 'alice' }, makeDbApi(raw) as never);
    await expect(
      getSettings(makeDbApi(raw) as never).then((s) => s.username)
    ).resolves.toBe('alice');
  });

  it('clears the username when set to null', async () => {
    const raw = freshDb();
    await updateSettings({ username: 'alice' }, makeDbApi(raw) as never);
    await updateSettings({ username: null }, makeDbApi(raw) as never);
    await expect(
      getSettings(makeDbApi(raw) as never).then((s) => s.username)
    ).resolves.toBeNull();
  });

  it('keeps other settings untouched when saving only the username', async () => {
    const raw = freshDb();
    await updateSettings({ currencySymbol: '$' }, makeDbApi(raw) as never);
    await updateSettings({ username: 'bob' }, makeDbApi(raw) as never);
    const settings = await getSettings(makeDbApi(raw) as never);
    expect(settings.currencySymbol).toBe('$');
    expect(settings.username).toBe('bob');
  });
});