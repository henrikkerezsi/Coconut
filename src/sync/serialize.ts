export interface LocalRow {
  [key: string]: unknown;
}

export interface RemoteRow {
  [key: string]: unknown;
}

export type FkToRemote = (
  localField: string,
  localValue: string | number | null
) => string | null;

export type FkToLocal = (
  remoteField: string,
  parentUuid: string | null
) => string | number | null;

export interface Field {
  local: string;
  remote: string;
  fk?: boolean;
  booleanType?: boolean;
}

export interface SyncTableAdapter {
  localTable: string;
  remoteTable: string;
  pullOrder: number;
  identityColumn: string;
  fields: Field[];
  naturalKeys?: string[];
  toRemote(row: LocalRow, fk: FkToRemote): RemoteRow;
  fromRemote(row: RemoteRow, fk: FkToLocal): LocalRow;
}

export interface AdapterOptions {
  localTable: string;
  remoteTable: string;
  pullOrder: number;
  identityColumn: string;
  fields: Field[];
  naturalKeys?: string[];
}

export function makeAdapter(options: AdapterOptions): SyncTableAdapter {
  const { localTable, remoteTable, pullOrder, identityColumn, fields, naturalKeys } = options;
  return {
    localTable,
    remoteTable,
    pullOrder,
    identityColumn,
    fields,
    naturalKeys,
    toRemote(row, fk) {
      const out: RemoteRow = {};
      for (const field of fields) {
        const value = row[field.local] ?? null;
        if (field.fk) {
          out[field.remote] =
            value === null ? null : fk(field.local, value as string | number);
        } else if (field.booleanType) {
          out[field.remote] = value === 0 || value === 1 ? value === 1 : Boolean(value);
        } else {
          out[field.remote] = value ?? null;
        }
      }
      return out;
    },
    fromRemote(row, fk) {
      const out: LocalRow = {};
      for (const field of fields) {
        const value = row[field.remote] ?? null;
        if (field.fk) {
          out[field.local] =
            value === null ? null : fk(field.remote, value as string);
        } else if (field.booleanType) {
          out[field.local] = value ? 1 : 0;
        } else {
          out[field.local] = value ?? null;
        }
      }
      return out;
    },
  };
}

export const COMPLETE_ADAPTERS: SyncTableAdapter[] = [
  makeAdapter({
    localTable: 'months',
    remoteTable: 'months',
    pullOrder: 0,
    identityColumn: 'month_key',
    fields: [
      { local: 'month_key', remote: 'month_key' },
      { local: 'allowance_cents', remote: 'allowance_cents' },
      { local: 'starting_reserve_cents', remote: 'starting_reserve_cents' },
      { local: 'ending_reserve_cents', remote: 'ending_reserve_cents' },
      { local: 'is_closed', remote: 'is_closed', booleanType: true },
      { local: 'closed_at', remote: 'closed_at' },
    ],
  }),
  makeAdapter({
    localTable: 'fixed_expenses',
    remoteTable: 'fixed_expenses',
    pullOrder: 1,
    identityColumn: 'uuid',
    fields: [
      { local: 'name', remote: 'name' },
      { local: 'expected_amount_cents', remote: 'expected_amount_cents' },
      { local: 'kind', remote: 'kind' },
      { local: 'recurrence', remote: 'recurrence' },
      { local: 'estimation_strategy', remote: 'estimation_strategy' },
      { local: 'average_months', remote: 'average_months' },
      { local: 'active', remote: 'active', booleanType: true },
      { local: 'sort_order', remote: 'sort_order' },
    ],
  }),
  makeAdapter({
    localTable: 'budgets',
    remoteTable: 'budgets',
    pullOrder: 2,
    identityColumn: 'uuid',
    fields: [
      { local: 'name', remote: 'name' },
      { local: 'default_amount_cents', remote: 'default_amount_cents' },
      { local: 'active', remote: 'active', booleanType: true },
      { local: 'sort_order', remote: 'sort_order' },
      { local: 'color', remote: 'color' },
    ],
  }),
  makeAdapter({
    localTable: 'yearly_subscriptions',
    remoteTable: 'yearly_subscriptions',
    pullOrder: 3,
    identityColumn: 'uuid',
    fields: [
      { local: 'name', remote: 'name' },
      { local: 'yearly_amount_cents', remote: 'yearly_amount_cents' },
      { local: 'monthly_amount_cents', remote: 'monthly_amount_cents' },
      { local: 'started_month', remote: 'started_month' },
      { local: 'billing_month', remote: 'billing_month' },
      { local: 'deduct_monthly', remote: 'deduct_monthly', booleanType: true },
      { local: 'active', remote: 'active', booleanType: true },
      { local: 'sort_order', remote: 'sort_order' },
    ],
  }),
  makeAdapter({
    localTable: 'month_fixed_expenses',
    remoteTable: 'month_fixed_expenses',
    pullOrder: 4,
    identityColumn: 'uuid',
    naturalKeys: ['month_key', 'fixed_expense_id'],
    fields: [
      { local: 'month_key', remote: 'month_key' },
      { local: 'fixed_expense_id', remote: 'fixed_expense_uuid', fk: true },
      { local: 'expected_amount_cents', remote: 'expected_amount_cents' },
      { local: 'actual_amount_cents', remote: 'actual_amount_cents' },
    ],
  }),
  makeAdapter({
    localTable: 'month_budgets',
    remoteTable: 'month_budgets',
    pullOrder: 5,
    identityColumn: 'uuid',
    naturalKeys: ['month_key', 'budget_id'],
    fields: [
      { local: 'month_key', remote: 'month_key' },
      { local: 'budget_id', remote: 'budget_uuid', fk: true },
      { local: 'planned_amount_cents', remote: 'planned_amount_cents' },
    ],
  }),
  makeAdapter({
    localTable: 'income',
    remoteTable: 'income',
    pullOrder: 6,
    identityColumn: 'uuid',
    fields: [
      { local: 'month_key', remote: 'month_key' },
      { local: 'date', remote: 'date' },
      { local: 'amount_cents', remote: 'amount_cents' },
      { local: 'description', remote: 'description' },
      { local: 'note', remote: 'note' },
    ],
  }),
  makeAdapter({
    localTable: 'reserve_transfers',
    remoteTable: 'reserve_transfers',
    pullOrder: 7,
    identityColumn: 'uuid',
    fields: [
      { local: 'month_key', remote: 'month_key' },
      { local: 'amount_cents', remote: 'amount_cents' },
      { local: 'direction', remote: 'direction' },
      { local: 'note', remote: 'note' },
    ],
  }),
  makeAdapter({
    localTable: 'transactions',
    remoteTable: 'transactions',
    pullOrder: 8,
    identityColumn: 'uuid',
    fields: [
      { local: 'month_key', remote: 'month_key' },
      { local: 'date', remote: 'date' },
      { local: 'amount_cents', remote: 'amount_cents' },
      { local: 'budget_id', remote: 'budget_uuid', fk: true },
      { local: 'merchant', remote: 'merchant' },
      { local: 'note', remote: 'note' },
      { local: 'origin_type', remote: 'origin_type' },
      { local: 'origin_id', remote: 'origin_id' },
    ],
  }),
];

export const SYNC_SETTINGS_KEYS = [
  'monthly_allowance_cents',
  'initial_reserve_cents',
  'currency_symbol',
  'theme_mode',
  'recent_transactions_count',
  'username',
] as const;