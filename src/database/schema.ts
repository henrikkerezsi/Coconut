export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS months (
  month_key TEXT PRIMARY KEY NOT NULL,
  allowance_cents INTEGER NOT NULL,
  starting_reserve_cents INTEGER NOT NULL,
  ending_reserve_cents INTEGER,
  is_closed INTEGER NOT NULL DEFAULT 0,
  closed_at TEXT
);

CREATE TABLE IF NOT EXISTS fixed_expenses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  expected_amount_cents INTEGER NOT NULL,
  kind TEXT NOT NULL DEFAULT 'fixed',
  recurrence TEXT NOT NULL DEFAULT 'monthly',
  estimation_strategy TEXT NOT NULL DEFAULT 'manual',
  average_months INTEGER,
  active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS month_fixed_expenses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  month_key TEXT NOT NULL,
  fixed_expense_id INTEGER NOT NULL,
  expected_amount_cents INTEGER NOT NULL,
  actual_amount_cents INTEGER,
  FOREIGN KEY (month_key) REFERENCES months (month_key) ON DELETE CASCADE,
  FOREIGN KEY (fixed_expense_id) REFERENCES fixed_expenses (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS budgets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  default_amount_cents INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS month_budgets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  month_key TEXT NOT NULL,
  budget_id INTEGER NOT NULL,
  planned_amount_cents INTEGER NOT NULL,
  FOREIGN KEY (month_key) REFERENCES months (month_key) ON DELETE CASCADE,
  FOREIGN KEY (budget_id) REFERENCES budgets (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  month_key TEXT NOT NULL,
  date TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  budget_id INTEGER,
  merchant TEXT NOT NULL,
  note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (month_key) REFERENCES months (month_key) ON DELETE CASCADE,
  FOREIGN KEY (budget_id) REFERENCES budgets (id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS reserve_transfers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  month_key TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  direction TEXT NOT NULL DEFAULT 'to-month',
  note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (month_key) REFERENCES months (month_key) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS merchant_suggestions (
  merchant TEXT NOT NULL,
  budget_id INTEGER NOT NULL,
  use_count INTEGER NOT NULL DEFAULT 1,
  last_used TEXT,
  PRIMARY KEY (merchant, budget_id),
  FOREIGN KEY (budget_id) REFERENCES budgets (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_months_period ON months (month_key);
CREATE INDEX IF NOT EXISTS idx_transactions_month ON transactions (month_key);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions (date);
CREATE INDEX IF NOT EXISTS idx_transactions_budget ON transactions (budget_id);
CREATE INDEX IF NOT EXISTS idx_month_fixed_month ON month_fixed_expenses (month_key);
CREATE INDEX IF NOT EXISTS idx_month_fixed_expense ON month_fixed_expenses (fixed_expense_id);
CREATE INDEX IF NOT EXISTS idx_month_budgets_month ON month_budgets (month_key);
CREATE INDEX IF NOT EXISTS idx_month_budgets_budget ON month_budgets (budget_id);
CREATE INDEX IF NOT EXISTS idx_reserve_transfers_month ON reserve_transfers (month_key);
`;