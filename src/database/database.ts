import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';
import { DATABASE_NAME } from '../utils/date';
import { MIGRATIONS, subscriptionRepairSql } from './migrations';

let dbPromise: Promise<SQLiteDatabase> | null = null;

export function getDatabase(): Promise<SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = openDatabaseAsync(DATABASE_NAME).then(async (db) => {
      await db.execAsync('PRAGMA journal_mode = WAL;');
      await db.execAsync('PRAGMA recursive_triggers = OFF;');
      await migrate(db);
      return db;
    });
  }
  return dbPromise;
}

export async function closeDatabase(): Promise<void> {
  if (dbPromise) {
    const db = await dbPromise;
    await db.closeAsync();
    dbPromise = null;
  }
}

export async function resetDatabase(): Promise<void> {
  await closeDatabase();
  dbPromise = getDatabase();
  await dbPromise;
}

export async function migrate(db: SQLiteDatabase): Promise<void> {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const currentVersion = row?.user_version ?? 0;
  const pending = MIGRATIONS.filter((migration) => migration.id > currentVersion).sort(
    (a, b) => a.id - b.id
  );
  for (const migration of pending) {
    await db.withTransactionAsync(async () => {
      await db.execAsync(migration.sql);
      await db.execAsync(`PRAGMA user_version = ${migration.id}`);
    });
  }
  await ensureSyncStateColumns(db);
  await ensureSubscriptionColumns(db);
}

async function ensureSyncStateColumns(db: SQLiteDatabase): Promise<void> {
  const columns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(sync_state)');
  if (columns.length > 0 && !columns.some((c) => c.name === 'last_sync_error')) {
    await db.execAsync('ALTER TABLE sync_state ADD COLUMN last_sync_error TEXT;');
  }
}

/**
 * Repairs the yearly_subscriptions table into the period-based shape
 * (total_amount_cents, start_month, end_month, no billing_month) no matter
 * which earlier dev schema it happens to be in. Runs on every startup, so it
 * also heals databases restored from old backups. Sync triggers are recreated
 * because rebuilding the table drops them.
 */
async function ensureSubscriptionColumns(db: SQLiteDatabase): Promise<void> {
  const columns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(yearly_subscriptions)');
  if (columns.length === 0) {
    return;
  }
  const hasColumn = (name: string) => columns.some((column) => column.name === name);

  if (
    hasColumn('total_amount_cents') &&
    hasColumn('start_month') &&
    hasColumn('end_month') &&
    !hasColumn('billing_month')
  ) {
    return;
  }

  await db.withTransactionAsync(async () => {
    await db.execAsync(`
      DROP TRIGGER IF EXISTS trg_yearly_subscriptions_ai;
      DROP TRIGGER IF EXISTS trg_yearly_subscriptions_au;
      DROP TRIGGER IF EXISTS trg_yearly_subscriptions_ad;

      ${subscriptionRepairSql({
        hasTotal: hasColumn('total_amount_cents'),
        hasStart: hasColumn('start_month'),
        hasEnd: hasColumn('end_month'),
        hasUuid: hasColumn('uuid'),
        hasUpdatedAt: hasColumn('updated_at'),
      })}
    `);
  });
}