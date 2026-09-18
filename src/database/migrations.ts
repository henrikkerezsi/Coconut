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
];