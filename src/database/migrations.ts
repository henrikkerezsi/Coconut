import { SCHEMA_SQL } from './schema';

export interface Migration {
  id: number;
  description: string;
  sql: string;
}

const SYNC_TABLE_SPECS: Record<string, { pk: string; identity: string }> = {
  months: { pk: 'month_key', identity: 'month_key' },
  fixed_expenses: { pk: 'id', identity: 'uuid' },
  month_fixed_expenses: { pk: 'id', identity: 'uuid' },
  budgets: { pk: 'id', identity: 'uuid' },
  month_budgets: { pk: 'id', identity: 'uuid' },
  transactions: { pk: 'id', identity: 'uuid' },
  income: { pk: 'id', identity: 'uuid' },
  reserve_transfers: { pk: 'id', identity: 'uuid' },
  yearly_subscriptions: { pk: 'id', identity: 'uuid' },
};

function syncTriggersSql(): string {
  const parts: string[] = [];
  const timestampSql = "strftime('%Y-%m-%dT%H:%M:%fZ','now')";
  const pullGuard = `(SELECT COALESCE((SELECT value FROM sync_meta WHERE key = 'pull_in_progress'), '0') = '0')`;
  for (const [table, { pk, identity }] of Object.entries(SYNC_TABLE_SPECS)) {
    parts.push(`
CREATE TRIGGER IF NOT EXISTS trg_${table}_ai AFTER INSERT ON ${table}
WHEN ${pullGuard}
BEGIN
  UPDATE ${table}
     SET uuid = lower(hex(randomblob(16))),
         updated_at = ${timestampSql}
   WHERE ${pk} = NEW.${pk} AND (uuid IS NULL OR updated_at IS NULL);
  INSERT INTO sync_outbox (table_name, row_key)
  SELECT '${table}', ${identity} FROM ${table} WHERE ${pk} = NEW.${pk}
  ON CONFLICT (table_name, row_key) DO UPDATE SET logged_at = excluded.logged_at;
END;

CREATE TRIGGER IF NOT EXISTS trg_${table}_au AFTER UPDATE ON ${table}
WHEN ${pullGuard}
BEGIN
  UPDATE ${table}
     SET updated_at = ${timestampSql}
   WHERE ${pk} = NEW.${pk};
  INSERT INTO sync_outbox (table_name, row_key)
  SELECT '${table}', ${identity} FROM ${table} WHERE ${pk} = NEW.${pk}
  ON CONFLICT (table_name, row_key) DO UPDATE SET logged_at = excluded.logged_at;
END;

CREATE TRIGGER IF NOT EXISTS trg_${table}_ad AFTER DELETE ON ${table}
WHEN ${pullGuard}
BEGIN
  INSERT INTO sync_tombstones (table_name, row_key, deleted_at)
  VALUES ('${table}', OLD.${identity}, ${timestampSql})
  ON CONFLICT (table_name, row_key) DO UPDATE SET deleted_at = excluded.deleted_at;
END;
`);
  }
  return parts.join('\n');
}

function dropSyncTriggersSql(): string {
  const names: string[] = [];
  for (const table of Object.keys(SYNC_TABLE_SPECS)) {
    names.push(`trg_${table}_ai`, `trg_${table}_au`, `trg_${table}_ad`);
  }
  return names.map((name) => `DROP TRIGGER IF EXISTS ${name};`).join('\n');
}

export const SHARED_TABLE_SPECS: Record<
  string,
  { pk: string; identity: string; spaceExpr: string }
> = {
  shared_spaces: { pk: 'id', identity: 'uuid', spaceExpr: 'OLD.uuid' },
  shared_space_members: {
    pk: 'id',
    identity: 'uuid',
    spaceExpr: '(SELECT uuid FROM shared_spaces WHERE id = OLD.space_id)',
  },
  shared_periods: {
    pk: 'id',
    identity: 'uuid',
    spaceExpr: '(SELECT uuid FROM shared_spaces WHERE id = OLD.space_id)',
  },
  shared_expenses: {
    pk: 'id',
    identity: 'uuid',
    spaceExpr: '(SELECT uuid FROM shared_spaces WHERE id = OLD.space_id)',
  },
  shared_expense_splits: {
    pk: 'id',
    identity: 'uuid',
    spaceExpr:
      '(SELECT s.uuid FROM shared_spaces s JOIN shared_expenses e ON e.space_id = s.id WHERE e.id = OLD.expense_id)',
  },
  shared_period_reports: {
    pk: 'id',
    identity: 'uuid',
    spaceExpr: '(SELECT uuid FROM shared_spaces WHERE id = OLD.space_id)',
  },
};

export const SHARED_TABLES: string[] = Object.keys(SHARED_TABLE_SPECS);

function sharedTriggersSql(): string {
  const parts: string[] = [];
  const timestampSql = "strftime('%Y-%m-%dT%H:%M:%fZ','now')";
  const pullGuard = `(SELECT COALESCE((SELECT value FROM sync_meta WHERE key = 'pull_in_progress'), '0') = '0')`;
  for (const [table, { pk, identity, spaceExpr }] of Object.entries(SHARED_TABLE_SPECS)) {
    parts.push(`
CREATE TRIGGER IF NOT EXISTS trg_${table}_ai AFTER INSERT ON ${table}
WHEN ${pullGuard}
BEGIN
  UPDATE ${table}
     SET uuid = lower(hex(randomblob(16))),
         updated_at = ${timestampSql}
   WHERE ${pk} = NEW.${pk} AND (uuid IS NULL OR updated_at IS NULL);
  INSERT INTO sync_outbox (table_name, row_key)
  SELECT '${table}', ${identity} FROM ${table} WHERE ${pk} = NEW.${pk}
  ON CONFLICT (table_name, row_key) DO UPDATE SET logged_at = excluded.logged_at;
END;

CREATE TRIGGER IF NOT EXISTS trg_${table}_au AFTER UPDATE ON ${table}
WHEN ${pullGuard}
BEGIN
  UPDATE ${table}
     SET updated_at = ${timestampSql}
   WHERE ${pk} = NEW.${pk};
  INSERT INTO sync_outbox (table_name, row_key)
  SELECT '${table}', ${identity} FROM ${table} WHERE ${pk} = NEW.${pk}
  ON CONFLICT (table_name, row_key) DO UPDATE SET logged_at = excluded.logged_at;
END;

CREATE TRIGGER IF NOT EXISTS trg_${table}_ad AFTER DELETE ON ${table}
WHEN ${pullGuard}
BEGIN
  INSERT INTO shared_sync_tombstones (table_name, row_key, space_uuid, deleted_at)
  VALUES ('${table}', OLD.${identity}, ${spaceExpr}, ${timestampSql})
  ON CONFLICT (table_name, row_key) DO UPDATE SET deleted_at = excluded.deleted_at;
END;
`);
  }
  return parts.join('\n');
}

const SHARED_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS shared_spaces (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  uuid TEXT,
  name TEXT NOT NULL,
  owner_user_id TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT,
  deleted INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS shared_space_members (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  uuid TEXT,
  space_id INTEGER NOT NULL,
  user_id TEXT,
  email TEXT,
  display_name TEXT,
  role TEXT NOT NULL DEFAULT 'member',
  status TEXT NOT NULL DEFAULT 'pending',
  joined_at TEXT,
  updated_at TEXT,
  FOREIGN KEY (space_id) REFERENCES shared_spaces (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS shared_periods (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  uuid TEXT,
  space_id INTEGER NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT,
  FOREIGN KEY (space_id) REFERENCES shared_spaces (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS shared_expenses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  uuid TEXT,
  space_id INTEGER NOT NULL,
  period_id INTEGER NOT NULL,
  description TEXT NOT NULL,
  total_amount_cents INTEGER NOT NULL,
  date TEXT NOT NULL,
  paid_by_member_id INTEGER NOT NULL,
  note TEXT,
  created_by_user_id TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT,
  deleted INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (space_id) REFERENCES shared_spaces (id) ON DELETE CASCADE,
  FOREIGN KEY (period_id) REFERENCES shared_periods (id) ON DELETE CASCADE,
  FOREIGN KEY (paid_by_member_id) REFERENCES shared_space_members (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS shared_expense_splits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  uuid TEXT,
  expense_id INTEGER NOT NULL,
  member_id INTEGER NOT NULL,
  amount_cents INTEGER NOT NULL,
  updated_at TEXT,
  FOREIGN KEY (expense_id) REFERENCES shared_expenses (id) ON DELETE CASCADE,
  FOREIGN KEY (member_id) REFERENCES shared_space_members (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS shared_period_reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  uuid TEXT,
  space_id INTEGER NOT NULL,
  period_id INTEGER NOT NULL,
  report_json TEXT NOT NULL,
  closed_at TEXT NOT NULL,
  closed_by_member_id INTEGER,
  updated_at TEXT,
  FOREIGN KEY (space_id) REFERENCES shared_spaces (id) ON DELETE CASCADE,
  FOREIGN KEY (period_id) REFERENCES shared_periods (id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_shared_spaces_uuid ON shared_spaces (uuid);
CREATE UNIQUE INDEX IF NOT EXISTS idx_shared_space_members_uuid ON shared_space_members (uuid);
CREATE UNIQUE INDEX IF NOT EXISTS idx_shared_periods_uuid ON shared_periods (uuid);
CREATE UNIQUE INDEX IF NOT EXISTS idx_shared_expenses_uuid ON shared_expenses (uuid);
CREATE UNIQUE INDEX IF NOT EXISTS idx_shared_expense_splits_uuid ON shared_expense_splits (uuid);
CREATE UNIQUE INDEX IF NOT EXISTS idx_shared_period_reports_uuid ON shared_period_reports (uuid);

CREATE UNIQUE INDEX IF NOT EXISTS idx_shared_space_members_user
  ON shared_space_members (space_id, user_id) WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_shared_space_members_email
  ON shared_space_members (space_id, email) WHERE email IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_shared_space_members_space ON shared_space_members (space_id);
CREATE INDEX IF NOT EXISTS idx_shared_periods_space ON shared_periods (space_id, status);
CREATE INDEX IF NOT EXISTS idx_shared_expenses_period ON shared_expenses (period_id);
CREATE INDEX IF NOT EXISTS idx_shared_expense_splits_expense ON shared_expense_splits (expense_id);

CREATE TABLE IF NOT EXISTS shared_sync_tombstones (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  table_name TEXT NOT NULL,
  row_key TEXT NOT NULL,
  space_uuid TEXT,
  deleted_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_shared_sync_tombstones_key
  ON shared_sync_tombstones (table_name, row_key);

${sharedTriggersSql()}
`;

export const MIGRATIONS: Migration[] = [
  {
    id: 1,
    description: 'Initial schema',
    sql: SCHEMA_SQL,
  },
  {
    id: 2,
    description: 'Transaction attachments',
    sql: `
ALTER TABLE transactions ADD COLUMN attachment BLOB;
ALTER TABLE transactions ADD COLUMN attachment_name TEXT;
ALTER TABLE transactions ADD COLUMN attachment_mime TEXT;
`,
  },
  {
    id: 3,
    description: 'One-off income',
    sql: `
CREATE TABLE IF NOT EXISTS income (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  month_key TEXT NOT NULL,
  date TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  description TEXT NOT NULL,
  note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (month_key) REFERENCES months (month_key) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_income_month ON income (month_key);
CREATE INDEX IF NOT EXISTS idx_income_date ON income (date);
`,
  },
  {
    id: 4,
    description: 'Yearly subscriptions',
    sql: `
CREATE TABLE IF NOT EXISTS yearly_subscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  yearly_amount_cents INTEGER NOT NULL,
  monthly_amount_cents INTEGER NOT NULL,
  started_month TEXT NOT NULL,
  billing_month TEXT NOT NULL,
  deduct_monthly INTEGER NOT NULL DEFAULT 1,
  active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_yearly_subscriptions_active ON yearly_subscriptions (active);
CREATE INDEX IF NOT EXISTS idx_yearly_subscriptions_sort ON yearly_subscriptions (sort_order);
`,
  },
  {
    id: 5,
    description: 'Flexible budget colors',
    sql: `
ALTER TABLE budgets ADD COLUMN color TEXT;
`,
  },
  {
    id: 6,
    description: 'Supabase sync configuration',
    sql: `
CREATE TABLE IF NOT EXISTS sync_state (
  id INTEGER PRIMARY KEY NOT NULL CHECK (id = 1),
  supabase_url TEXT,
  anon_key TEXT,
  enabled INTEGER NOT NULL DEFAULT 0,
  last_sync_at TEXT,
  last_sync_status TEXT
);
`,
  },
  {
    id: 7,
    description: 'Supabase row synchronization support',
    sql: `
ALTER TABLE settings ADD COLUMN updated_at TEXT;
${Object.keys(SYNC_TABLE_SPECS)
  .map(
    (table) => `
ALTER TABLE ${table} ADD COLUMN uuid TEXT;
ALTER TABLE ${table} ADD COLUMN updated_at TEXT;`
  )
  .join('\n')}
ALTER TABLE transactions ADD COLUMN origin_type TEXT;
ALTER TABLE transactions ADD COLUMN origin_id TEXT;

${Object.keys(SYNC_TABLE_SPECS)
  .map(
    (table) => `
CREATE UNIQUE INDEX IF NOT EXISTS idx_${table}_uuid ON ${table} (uuid);`
  )
  .join('\n')}

UPDATE settings SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE updated_at IS NULL;
${Object.keys(SYNC_TABLE_SPECS)
  .map(
    (table) => `
UPDATE ${table}
   SET uuid = lower(hex(randomblob(16))),
       updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
 WHERE uuid IS NULL;`
  )
  .join('\n')}

CREATE TABLE IF NOT EXISTS sync_meta (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT
);

CREATE TABLE IF NOT EXISTS sync_outbox (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  table_name TEXT NOT NULL,
  row_key TEXT NOT NULL,
  logged_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_sync_outbox_row ON sync_outbox (table_name, row_key);

CREATE TABLE IF NOT EXISTS sync_tombstones (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  table_name TEXT NOT NULL,
  row_key TEXT NOT NULL,
  deleted_at TEXT NOT NULL,
  UNIQUE (table_name, row_key)
);

${syncTriggersSql()}
`,
  },
  {
    id: 8,
    description: 'Rename sync_state.anon_key to api_key',
    sql: `
ALTER TABLE sync_state RENAME COLUMN anon_key TO api_key;
`,
  },
  {
    id: 9,
    description: 'Recreate sync change-capture triggers',
    sql: `
${dropSyncTriggersSql()}
${syncTriggersSql()}
`,
  },
  {
    id: 10,
    description: 'Shared spaces, periods, expenses, splits and reports',
    sql: SHARED_SCHEMA_SQL,
  },
  {
    id: 11,
    description: 'Last sync error for visible diagnostics',
    sql: `
ALTER TABLE sync_state ADD COLUMN last_sync_error TEXT;
`,
  },
];