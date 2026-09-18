import { makeAdapter, type SyncTableAdapter } from './serialize';

export const SHARED_ADAPTERS: SyncTableAdapter[] = [
  makeAdapter({
    localTable: 'shared_spaces',
    remoteTable: 'shared_spaces',
    pullOrder: 0,
    identityColumn: 'uuid',
    fields: [
      { local: 'name', remote: 'name' },
      { local: 'owner_user_id', remote: 'owner_user_id' },
      { local: 'deleted', remote: 'deleted', booleanType: true },
    ],
  }),
  makeAdapter({
    localTable: 'shared_space_members',
    remoteTable: 'shared_space_members',
    pullOrder: 1,
    identityColumn: 'uuid',
    fields: [
      { local: 'space_id', remote: 'space_uuid', fk: true },
      { local: 'user_id', remote: 'user_id' },
      { local: 'email', remote: 'email' },
      { local: 'display_name', remote: 'display_name' },
      { local: 'role', remote: 'role' },
      { local: 'status', remote: 'status' },
      { local: 'joined_at', remote: 'joined_at' },
    ],
  }),
  makeAdapter({
    localTable: 'shared_periods',
    remoteTable: 'shared_periods',
    pullOrder: 2,
    identityColumn: 'uuid',
    fields: [
      { local: 'space_id', remote: 'space_uuid', fk: true },
      { local: 'start_date', remote: 'start_date' },
      { local: 'end_date', remote: 'end_date' },
      { local: 'status', remote: 'status' },
    ],
  }),
  makeAdapter({
    localTable: 'shared_expenses',
    remoteTable: 'shared_expenses',
    pullOrder: 3,
    identityColumn: 'uuid',
    fields: [
      { local: 'space_id', remote: 'space_uuid', fk: true },
      { local: 'period_id', remote: 'period_uuid', fk: true },
      { local: 'description', remote: 'description' },
      { local: 'total_amount_cents', remote: 'total_amount_cents' },
      { local: 'date', remote: 'date' },
      { local: 'paid_by_member_id', remote: 'paid_by_member_uuid', fk: true },
      { local: 'note', remote: 'note' },
      { local: 'created_by_user_id', remote: 'created_by_user_id' },
      { local: 'deleted', remote: 'deleted', booleanType: true },
    ],
  }),
  makeAdapter({
    localTable: 'shared_expense_splits',
    remoteTable: 'shared_expense_splits',
    pullOrder: 4,
    identityColumn: 'uuid',
    fields: [
      { local: 'expense_id', remote: 'expense_uuid', fk: true },
      { local: 'member_id', remote: 'member_uuid', fk: true },
      { local: 'amount_cents', remote: 'amount_cents' },
    ],
  }),
  makeAdapter({
    localTable: 'shared_period_reports',
    remoteTable: 'shared_period_reports',
    pullOrder: 5,
    identityColumn: 'uuid',
    fields: [
      { local: 'space_id', remote: 'space_uuid', fk: true },
      { local: 'period_id', remote: 'period_uuid', fk: true },
      { local: 'report_json', remote: 'report_json' },
      { local: 'closed_at', remote: 'closed_at' },
      { local: 'closed_by_member_id', remote: 'closed_by_member_uuid', fk: true },
    ],
  }),
];

export const SHARED_REMOTE_TABLES: string[] = [
  ...SHARED_ADAPTERS.map((adapter) => adapter.remoteTable),
  'shared_sync_tombstones',
];

export const SHARED_REMOTE_COLUMNS: Record<string, string[]> = {
  shared_spaces: ['uuid', 'name', 'owner_user_id', 'deleted', 'updated_at'],
  shared_space_members: [
    'uuid',
    'space_uuid',
    'user_id',
    'email',
    'display_name',
    'role',
    'status',
    'joined_at',
    'updated_at',
  ],
  shared_periods: ['uuid', 'space_uuid', 'start_date', 'end_date', 'status', 'updated_at'],
  shared_expenses: [
    'uuid',
    'space_uuid',
    'period_uuid',
    'description',
    'total_amount_cents',
    'date',
    'paid_by_member_uuid',
    'note',
    'created_by_user_id',
    'deleted',
    'updated_at',
  ],
  shared_expense_splits: ['uuid', 'expense_uuid', 'member_uuid', 'amount_cents', 'updated_at'],
  shared_period_reports: [
    'uuid',
    'space_uuid',
    'period_uuid',
    'report_json',
    'closed_at',
    'closed_by_member_uuid',
    'updated_at',
  ],
};
