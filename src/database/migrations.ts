import { SCHEMA_SQL } from './schema';

export interface Migration {
  id: number;
  description: string;
  sql: string;
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
];