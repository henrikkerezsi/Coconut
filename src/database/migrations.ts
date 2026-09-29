import { SCHEMA_SQL } from './schema';

export interface Migration {
  id: number;
  description: string;
  sql: string;
}

export interface SubscriptionRepairColumns {
  hasTotal: boolean;
  hasStart: boolean;
  hasEnd: boolean;
  hasUuid: boolean;
  hasUpdatedAt: boolean;
}

/**
 * Builds the SQL that normalizes yearly_subscriptions into the period-based
 * shape (total_amount_cents, start_month, end_month, no billing_month) no
 * matter which earlier schema the table is in. Used to heal databases that
 * predate the period-based redesign.
 */
export function subscriptionRepairSql(columns: SubscriptionRepairColumns): string {
  const totalColumn = columns.hasTotal ? 'total_amount_cents' : 'yearly_amount_cents';
  const startColumn = columns.hasStart ? 'start_month' : 'started_month';
  const endExpr = columns.hasEnd ? "COALESCE(end_month, '9999-12')" : "'9999-12'";
  const uuidExpr = columns.hasUuid ? 'uuid' : 'lower(hex(randomblob(16)))';
  const updatedExpr = columns.hasUpdatedAt
    ? 'updated_at'
    : "strftime('%Y-%m-%dT%H:%M:%fZ','now')";
  return `
CREATE TABLE yearly_subscriptions_v2 (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  total_amount_cents INTEGER NOT NULL,
  monthly_amount_cents INTEGER NOT NULL,
  start_month TEXT NOT NULL,
  end_month TEXT NOT NULL DEFAULT '9999-12',
  deduct_monthly INTEGER NOT NULL DEFAULT 1,
  active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  uuid TEXT,
  updated_at TEXT
);

INSERT OR IGNORE INTO yearly_subscriptions_v2
  (id, name, total_amount_cents, monthly_amount_cents, start_month, end_month, deduct_monthly, active, sort_order, created_at, uuid, updated_at)
  SELECT id, name, ${totalColumn}, monthly_amount_cents, ${startColumn}, ${endExpr}, deduct_monthly, active, sort_order, created_at, ${uuidExpr}, ${updatedExpr}
  FROM yearly_subscriptions;

DROP TABLE yearly_subscriptions;
ALTER TABLE yearly_subscriptions_v2 RENAME TO yearly_subscriptions;

CREATE INDEX IF NOT EXISTS idx_yearly_subscriptions_active ON yearly_subscriptions (active);
CREATE INDEX IF NOT EXISTS idx_yearly_subscriptions_sort ON yearly_subscriptions (sort_order);
CREATE UNIQUE INDEX IF NOT EXISTS idx_yearly_subscriptions_uuid ON yearly_subscriptions (uuid);

${syncTriggersSql()}
`;
}

interface SyncTableSpec {
  pk: string;
  identity: string;
}

/**
 * The tables whose rows sync, and the migration that brings each one's sync
 * support into being.
 *
 * The migration is what decides when a table is added to the change-capture
 * triggers, never this list. Earlier migrations already embed the trigger SQL
 * built from this list at the moment the module loads, so a table added to it
 * later still has to exist by the time the first of those migrations runs. A
 * table introduced by a later migration therefore declares its triggers in that
 * migration instead, and names its own spec here so the same trigger SQL can be
 * rebuilt for it.
 */
const SYNC_TABLE_SPECS: Record<string, { spec: SyncTableSpec; addedIn: number }> = {
  months: { spec: { pk: 'month_key', identity: 'month_key' }, addedIn: 1 },
  fixed_expenses: { spec: { pk: 'id', identity: 'uuid' }, addedIn: 1 },
  month_fixed_expenses: { spec: { pk: 'id', identity: 'uuid' }, addedIn: 1 },
  budgets: { spec: { pk: 'id', identity: 'uuid' }, addedIn: 1 },
  month_budgets: { spec: { pk: 'id', identity: 'uuid' }, addedIn: 1 },
  transactions: { spec: { pk: 'id', identity: 'uuid' }, addedIn: 1 },
  income: { spec: { pk: 'id', identity: 'uuid' }, addedIn: 1 },
  reserve_transfers: { spec: { pk: 'id', identity: 'uuid' }, addedIn: 1 },
  yearly_subscriptions: { spec: { pk: 'id', identity: 'uuid' }, addedIn: 1 },
  month_budget_plan_events: { spec: { pk: 'id', identity: 'uuid' }, addedIn: 15 },
};

/**
 * The sync tables that already exist by the first migration, which is what the
 * trigger SQL embedded in the earlier migrations was built from. A migration
 * that introduces its own synced table declares that table's triggers in its own
 * SQL and never widens this.
 */
function baselineSyncTableSpecs(): [string, SyncTableSpec][] {
  return Object.entries(SYNC_TABLE_SPECS)
    .filter(([, { addedIn }]) => addedIn <= 1)
    .map(([table, { spec }]) => [table, spec]);
}

/**
 * The change-capture triggers for the given synced tables. A migration that
 * introduces its own synced table uses this to declare them, so that adding a
 * table never has to change the trigger SQL an earlier migration already wrote.
 */
export function syncTriggersForTablesSql(tables: string[]): string {
  return buildSyncTriggersSql(
    tables.map((table) => {
      const entry = SYNC_TABLE_SPECS[table];
      if (entry === undefined) {
        throw new Error(`${table} is not a synced table`);
      }
      return [table, entry.spec] as [string, SyncTableSpec];
    })
  );
}

export function syncTriggersSql(): string {
  return buildSyncTriggersSql(baselineSyncTableSpecs());
}

function buildSyncTriggersSql(tables: [string, SyncTableSpec][]): string {
  const parts: string[] = [];
  const timestampSql = "strftime('%Y-%m-%dT%H:%M:%fZ','now')";
  const pullGuard = `(SELECT COALESCE((SELECT value FROM sync_meta WHERE key = 'pull_in_progress'), '0') = '0')`;
  for (const [table, { pk, identity }] of tables) {
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
  for (const table of baselineSyncTableSpecs().map(([table]) => table)) {
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
${baselineSyncTableSpecs()
  .map(
    ([table]) => `
ALTER TABLE ${table} ADD COLUMN uuid TEXT;
ALTER TABLE ${table} ADD COLUMN updated_at TEXT;`
  )
  .join('\n')}
ALTER TABLE transactions ADD COLUMN origin_type TEXT;
ALTER TABLE transactions ADD COLUMN origin_id TEXT;

${baselineSyncTableSpecs()
  .map(
    ([table]) => `
CREATE UNIQUE INDEX IF NOT EXISTS idx_${table}_uuid ON ${table} (uuid);`
  )
  .join('\n')}

UPDATE settings SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE updated_at IS NULL;
${baselineSyncTableSpecs()
  .map(
    ([table]) => `
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
  {
    id: 12,
    description: 'Period-based subscriptions',
    sql: `
CREATE TABLE yearly_subscriptions_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  total_amount_cents INTEGER NOT NULL,
  monthly_amount_cents INTEGER NOT NULL,
  start_month TEXT NOT NULL,
  end_month TEXT NOT NULL DEFAULT '9999-12',
  deduct_monthly INTEGER NOT NULL DEFAULT 1,
  active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  uuid TEXT,
  updated_at TEXT
);

INSERT INTO yearly_subscriptions_new
  (id, name, total_amount_cents, monthly_amount_cents, start_month, end_month, deduct_monthly, active, sort_order, created_at, uuid, updated_at)
SELECT id, name, yearly_amount_cents, monthly_amount_cents, started_month, '9999-12', deduct_monthly, active, sort_order, created_at, uuid, updated_at
  FROM yearly_subscriptions;

DROP TABLE yearly_subscriptions;
ALTER TABLE yearly_subscriptions_new RENAME TO yearly_subscriptions;

CREATE INDEX IF NOT EXISTS idx_yearly_subscriptions_active ON yearly_subscriptions (active);
CREATE INDEX IF NOT EXISTS idx_yearly_subscriptions_sort ON yearly_subscriptions (sort_order);
CREATE UNIQUE INDEX IF NOT EXISTS idx_yearly_subscriptions_uuid ON yearly_subscriptions (uuid);

${syncTriggersSql()}
`,
  },
  {
    id: 13,
    description: 'Per-month subscription charges',
    // Snapshot of the subscriptions that charged a month, so closed-month
    // reports and statistics never change when a subscription is later edited,
    // deactivated or deleted. Derived from yearly_subscriptions, therefore not
    // synced: every device materializes its own charges.
    sql: `
CREATE TABLE month_subscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  month_key TEXT NOT NULL,
  subscription_id INTEGER,
  name TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  FOREIGN KEY (month_key) REFERENCES months (month_key) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_month_subscriptions_month ON month_subscriptions (month_key);
CREATE UNIQUE INDEX IF NOT EXISTS idx_month_subscriptions_unique
  ON month_subscriptions (month_key, subscription_id);

INSERT OR IGNORE INTO month_subscriptions (month_key, subscription_id, name, amount_cents)
SELECT m.month_key, s.id, s.name, s.monthly_amount_cents
  FROM months m
  JOIN yearly_subscriptions s
    ON s.active = 1
   AND s.deduct_monthly = 1
   AND m.month_key >= s.start_month
   AND m.month_key <= s.end_month;
`,
  },
  {
    id: 14,
    description: 'Per-transaction value rating',
    // How much value a purchase turned out to be, chosen by the user while
    // reviewing a month before closing it. Nullable: no rating means the user
    // never judged the purchase, which counts as neutral. Synced with the
    // transactions table, which already carries uuid/updated_at and triggers.
    sql: `
ALTER TABLE transactions ADD COLUMN rating TEXT
  CHECK (rating IS NULL OR rating IN ('regret', 'neutral', 'good'));
`,
  },
  {
    id: 15,
    description: 'Month plan record',
    // The record of how a month's plan was arrived at: the amount each budget
    // started at, every explicit change to it afterwards, and every explicit
    // change to the planned reserve draw together with the budget the money was
    // handed to. Written only when the user explicitly re-plans, so it is a
    // history of decisions and never a second source of truth for the plan: the
    // plan itself stays in month_budgets.
    //
    // Not backfilled. Existing months have no record of what they started at,
    // and inventing one would be a claim about a past this data does not have.
    // The record opens with the first explicit re-plan, which records the amount
    // as it stands at that moment.
    sql: `
CREATE TABLE IF NOT EXISTS month_budget_plan_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  month_key TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('initial', 'budget', 'draw')),
  budget_id INTEGER,
  previous_amount_cents INTEGER NOT NULL,
  new_amount_cents INTEGER NOT NULL,
  funded_budget_id INTEGER,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  uuid TEXT,
  updated_at TEXT,
  FOREIGN KEY (month_key) REFERENCES months (month_key) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_month_budget_plan_events_month
  ON month_budget_plan_events (month_key, id);
CREATE INDEX IF NOT EXISTS idx_month_budget_plan_events_budget
  ON month_budget_plan_events (month_key, budget_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_month_budget_plan_events_uuid
  ON month_budget_plan_events (uuid);

${syncTriggersForTablesSql(['month_budget_plan_events'])}
`,
  },
];
