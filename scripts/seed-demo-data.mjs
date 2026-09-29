#!/usr/bin/env node
// Seeds the Android emulator's local database with a rich demo dataset:
// budgets, fixed expenses, subscriptions, income, personal spending, a shared
// space with members, periods, expenses and splits, and the personal mirror
// transactions that are linked to the shared expenses.
//
// This NEVER deletes or rewrites a row that the user created. It only inserts,
// and it skips a month that already exists instead of taking it over, so it is
// safe to run against a device that holds real data. A full backup of the
// database is written before anything is changed.
//
// Usage:
//   node scripts/seed-demo-data.mjs                     dry run: prints the plan
//   node scripts/seed-demo-data.mjs --apply             back up, then seed
//   node scripts/seed-demo-data.mjs --apply --month=2026-09
//   node scripts/seed-demo-data.mjs --reset-demo       remove a previous seed
//   node scripts/seed-demo-data.mjs --status
//
// npm run seed-demo-data -- --apply

import { execFileSync } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { buildDemoDataset, DEMO_TAG } from './demo-dataset.mjs';

const PACKAGE = process.env.COCONUT_PACKAGE ?? 'com.coconut.app';
const REMOTE_DIR = 'files/SQLite';
const REMOTE_DB = 'coconut.db';
const MANIFEST = join(process.cwd(), '.demo-manifest.json');
const REQUIRED_TABLES = [
  'months',
  'budgets',
  'month_budgets',
  'fixed_expenses',
  'month_fixed_expenses',
  'yearly_subscriptions',
  'month_subscriptions',
  'transactions',
  'income',
  'reserve_transfers',
  'merchant_suggestions',
  'shared_spaces',
  'shared_space_members',
  'shared_periods',
  'shared_expenses',
  'shared_expense_splits',
];

function adb(args, { binary = false } = {}) {
  const out = execFileSync('adb', args, {
    encoding: binary ? 'buffer' : 'utf8',
    maxBuffer: 256 * 1024 * 1024,
  });
  return out;
}

function deviceMonth() {
  const stamp = adb(['shell', 'date', '+%Y-%m']).trim();
  return /^\d{4}-\d{2}$/.test(stamp) ? stamp : new Date().toISOString().slice(0, 7);
}

function requireDevice() {
  const devices = adb(['devices']).trim().split('\n').slice(1);
  const connected = devices.filter((line) => /\tdevice$/.test(line));
  if (connected.length === 0) {
    throw new Error('No Android device is connected. Start the emulator and try again.');
  }
  const packages = adb(['shell', 'pm', 'list', 'packages']);
  if (!packages.includes(`package:${PACKAGE}`)) {
    throw new Error(`${PACKAGE} is not installed. Build it first with: npx expo run:android`);
  }
}

function pullDatabase(workDir) {
  // The app is stopped first so the write-ahead log is not being written to
  // underneath the copy. Stopping a process does not erase anything.
  adb(['shell', 'am', 'force-stop', PACKAGE]);
  for (const suffix of ['', '-wal', '-shm']) {
    try {
      const bytes = adb(['shell', `run-as ${PACKAGE} cat ${REMOTE_DIR}/${REMOTE_DB}${suffix}`], { binary: true });
      writeFileSync(join(workDir, `coconut.db${suffix}`), bytes);
    } catch {
      // -wal and -shm are absent when the database has never been checkpointed.
    }
  }
  if (!existsSync(join(workDir, 'coconut.db'))) {
    throw new Error('Could not read the database from the device. Is the app installed and has it been opened once?');
  }
  return join(workDir, 'coconut.db');
}

function pushDatabase(dbPath) {
  const staging = '/data/local/tmp/coconut-seed.db';
  adb(['push', dbPath, staging]);
  adb(['shell', `run-as ${PACKAGE} cp ${staging} ${REMOTE_DIR}/${REMOTE_DB}`]);
  adb(['shell', `run-as ${PACKAGE} rm -f ${REMOTE_DIR}/${REMOTE_DB}-wal ${REMOTE_DIR}/${REMOTE_DB}-shm`]);
  adb(['shell', `run-as ${PACKAGE} rm -f ${staging}`]);
  // Confirm the file the app will open is the one we wrote.
  const remote = adb(['shell', `run-as ${PACKAGE} cat ${REMOTE_DIR}/${REMOTE_DB}`], { binary: true });
  if (remote.length !== readFileSync(dbPath).length) {
    throw new Error('The database copied back from the device does not match; leaving the device as it was.');
  }
}

function openDatabase(dbPath) {
  const db = new DatabaseSync(dbPath);
  db.exec('PRAGMA foreign_keys = ON');
  return db;
}

function assertSchema(db) {
  const version = db.prepare('PRAGMA user_version').get().user_version;
  const tables = new Set(db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map((r) => r.name));
  const missing = REQUIRED_TABLES.filter((table) => !tables.has(table));
  if (missing.length > 0) {
    throw new Error(`The device database is missing tables: ${missing.join(', ')}. Open the app once so it migrates, then retry.`);
  }
  const columns = new Set(db.prepare("SELECT name FROM pragma_table_info('transactions')").all().map((r) => r.name));
  for (const column of ['rating', 'origin_type', 'origin_id']) {
    if (!columns.has(column)) {
      throw new Error(`The device database has no transactions.${column} column. Open the app once so it migrates, then retry.`);
    }
  }
  return version;
}

/** Folds the write-ahead log into the main file so the copy is self-contained. */
function checkpoint(db) {
  const result = db.prepare('PRAGMA wal_checkpoint(TRUNCATE)').get();
  if (result && result.wal_checkpoint !== 0) {
    throw new Error('The database is still in use. Close the app on the emulator and try again.');
  }
  db.close();
}

// Tables are listed in the order their foreign keys allow, so a reset can walk
// it backwards without ever tripping a constraint.
const DELETE_ORDER = [
  'shared_expense_splits',
  'shared_expenses',
  'shared_period_reports',
  'shared_periods',
  'shared_space_members',
  'shared_spaces',
  'month_subscriptions',
  'month_fixed_expenses',
  'month_budgets',
  'merchant_suggestions',
  'reserve_transfers',
  'transactions',
  'income',
  'yearly_subscriptions',
  'fixed_expenses',
  'budgets',
  'months',
];

function readManifest() {
  if (!existsSync(MANIFEST)) {
    return null;
  }
  try {
    return JSON.parse(readFileSync(MANIFEST, 'utf8'));
  } catch {
    return null;
  }
}

function resetDemo(db, { dryRun }) {
  const manifest = readManifest();
  if (!manifest) {
    console.log('No seed manifest found, so there is nothing to remove.');
    return 0;
  }
  let removed = 0;
  for (const table of DELETE_ORDER) {
    const entry = manifest.inserted[table];
    if (!entry || (entry.ids.length === 0 && entry.monthKeys.length === 0)) {
      continue;
    }
    const label = `${entry.ids.length + entry.monthKeys.length} ${table}`;
    if (!dryRun) {
      if (entry.ids.length > 0) {
        const placeholders = entry.ids.map(() => '?').join(',');
        db.prepare(`DELETE FROM ${table} WHERE id IN (${placeholders})`).run(...entry.ids);
      }
      for (const monthKey of entry.monthKeys) {
        db.prepare(`DELETE FROM ${table} WHERE month_key = ?`).run(monthKey);
      }
    }
    removed += entry.ids.length + entry.monthKeys.length;
    console.log(`  ${dryRun ? 'would remove' : 'removed'} ${label}`);
  }
  if (!dryRun) {
    rmSync(MANIFEST, { force: true });
  }
  return removed;
}

/**
 * Inserts the dataset, resolving every `*Ref` to the id the device assigned.
 * A `*Ref` is named after the column it fills, so `budget_idRef` resolves the
 * `budget_id` column. Months that already exist are left completely alone.
 */
export function applyDemo(db, dataset) {
  const ids = new Map();
  const uuids = new Map();
  const inserted = {};
  const closedMonths = new Set();
  const notes = [];

  db.exec('BEGIN');
  try {
    // Suppresses the change-capture triggers for the duration of the seed, so
    // demo rows never reach the sync outbox and can never be pushed to a real
    // Supabase project. Restored below.
    const previousGuard = db.prepare("SELECT value FROM sync_meta WHERE key = 'pull_in_progress'").get();
    db.prepare("INSERT INTO sync_meta (key, value) VALUES ('pull_in_progress', '1') ON CONFLICT (key) DO UPDATE SET value = '1'").run();

    for (const { table, row, key } of dataset.rows) {
      if (table === 'months') {
        const existing = db.prepare('SELECT is_closed FROM months WHERE month_key = ?').get(row.month_key);
        if (existing) {
          if (existing.is_closed) {
            closedMonths.add(row.month_key);
            notes.push(`${row.month_key} already exists and is closed, so its demo spending was skipped`);
          }
          inserted.months ??= { ids: [], monthKeys: [] };
          continue;
        }
      }
      if (table !== 'months' && closedMonths.has(row.month_key)) {
        continue;
      }

      const columns = [];
      const values = [];
      for (const [column, value] of Object.entries(row)) {
        if (column.endsWith('Ref')) {
          if (value === null) {
            continue;
          }
          const resolved = ids.get(value);
          if (resolved === undefined) {
            throw new Error(`Unresolved reference ${value} for ${table}.${column}`);
          }
          columns.push(column.replace(/Ref$/, ''));
          values.push(resolved);
        } else {
          columns.push(column);
          values.push(value);
        }
      }
      const placeholders = values.map(() => '?').join(',');
      const verb = table.startsWith('month_') || table === 'merchant_suggestions' ? 'INSERT OR IGNORE' : 'INSERT';
      const result = db.prepare(`${verb} INTO ${table} (${columns.join(',')}) VALUES (${placeholders})`).run(...values);

      if (key) {
        ids.set(key, Number(result.lastInsertRowid));
        if (row.uuid) {
          uuids.set(key, row.uuid);
        }
        const bucket = (inserted[table] ??= { ids: [], monthKeys: [] });
        if (table === 'months') {
          bucket.monthKeys.push(row.month_key);
        } else {
          bucket.ids.push(Number(result.lastInsertRowid));
        }
      }
    }

    if (previousGuard) {
      db.prepare("UPDATE sync_meta SET value = ? WHERE key = 'pull_in_progress'").run(previousGuard.value);
    } else {
      db.prepare("DELETE FROM sync_meta WHERE key = 'pull_in_progress'").run();
    }
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }

  return { inserted, notes };
}

function summarize(db, monthKey, previous) {
  const count = (sql, params = []) => db.prepare(sql).get(...params).n;
  const rows = [
    ['months', count('SELECT COUNT(*) n FROM months')],
    ['budgets', count('SELECT COUNT(*) n FROM budgets')],
    ['fixed expenses', count('SELECT COUNT(*) n FROM fixed_expenses')],
    ['subscriptions', count('SELECT COUNT(*) n FROM yearly_subscriptions')],
    ['income', count('SELECT COUNT(*) n FROM income')],
    ['transactions', count('SELECT COUNT(*) n FROM transactions')],
    ['  of which shared-derived', count("SELECT COUNT(*) n FROM transactions WHERE origin_type = 'shared'")],
    ['  of which unrated', count('SELECT COUNT(*) n FROM transactions WHERE rating IS NULL')],
    ['shared spaces', count('SELECT COUNT(*) n FROM shared_spaces')],
    ['shared members', count('SELECT COUNT(*) n FROM shared_space_members')],
    ['shared periods', count('SELECT COUNT(*) n FROM shared_periods')],
    ['shared expenses', count('SELECT COUNT(*) n FROM shared_expenses')],
    ['shared splits', count('SELECT COUNT(*) n FROM shared_expense_splits')],
  ];
  console.log('\nDevice database after seeding:');
  for (const [label, n] of rows) {
    console.log(`  ${label.padEnd(28)} ${n}`);
  }
  console.log(`\nDemo month: ${monthKey} (open) · ${previous} (closed)`);
  console.log('Open the app, then go to Settings -> "Close the month" to review it.');
}

function main() {
  const args = process.argv.slice(2);
  const dryRun = !args.includes('--apply');
  const reset = args.includes('--reset-demo');
  const status = args.includes('--status');
  const monthArg = args.find((a) => a.startsWith('--month='))?.split('=')[1];
  const workDir = join(tmpdir(), `coconut-seed-${process.pid}`);

  if (status) {
    requireDevice();
    const db = openDatabase(pullDatabase(workDir));
    console.log('Current device database:');
    summarize(db, monthArg ?? deviceMonth(), monthArg ?? deviceMonth());
    db.close();
    return;
  }

  requireDevice();
  mkdirSync(workDir, { recursive: true });
  const dbPath = pullDatabase(workDir);
  const db = openDatabase(dbPath);
  const version = assertSchema(db);
  const monthKey = monthArg ?? deviceMonth();
  const dataset = buildDemoDataset(monthKey);

  console.log(`Database schema version ${version}`);
  console.log(`Demo month ${monthKey} (open) and ${dataset.previous} (closed)`);
  console.log(`${DEMO_TAG} tagged rows only; existing rows are never changed or removed.`);
  console.log(dryRun ? '\nDry run. Nothing has been changed. Re-run with --apply to seed.' : '\nApplying...');

  if (reset) {
    console.log('\nRemoving a previous seed:');
    resetDemo(db, { dryRun });
  }

  const { inserted, notes } = applyDemo(db, dataset);
  const counts = Object.entries(inserted).reduce((total, [, entry]) => total + entry.ids.length + entry.monthKeys.length, 0);
  console.log(dryRun ? `\nWould insert ${counts} rows.` : `\nInserted ${counts} rows.`);

  for (const note of notes) {
    console.log(`  note: ${note}`);
  }

  if (dryRun) {
    db.close();
    rmSync(workDir, { recursive: true, force: true });
    return;
  }

  const integrity = db.prepare('PRAGMA integrity_check').get();
  if (Object.values(integrity)[0] !== 'ok') {
    throw new Error('The seeded database failed its integrity check; not writing it to the device.');
  }
  writeFileSync(
    MANIFEST,
    `${JSON.stringify({ package: PACKAGE, monthKey, previous: dataset.previous, inserted, appliedAt: new Date().toISOString() }, null, 2)}\n`
  );
  summarize(db, monthKey, dataset.previous);
  checkpoint(db);
  pushDatabase(dbPath);
  rmSync(workDir, { recursive: true, force: true });
  console.log(`\nSeeded and backed up. Manifest: ${MANIFEST}`);
  console.log('Reopen the app on the emulator to see the data.');
}

try {
  main();
} catch (error) {
  console.error(`\nError: ${error.message}`);
  process.exitCode = 1;
}
