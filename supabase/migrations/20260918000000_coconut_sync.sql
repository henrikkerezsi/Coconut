-- Coconut: Supabase sync schema.
-- Personal row-level sync: every row is keyed to the owning Supabase Auth user,
-- protected by RLS (user_id = auth.uid()).

-- Settings synced by allowlisted key (device-local prefs stay local).
create table if not exists public.settings (
  key text not null,
  value text not null,
  user_id uuid not null default auth.uid(),
  updated_at timestamptz not null default now(),
  primary key (user_id, key)
);

-- Deletes propagated to other devices.
create table if not exists public.sync_tombstones (
  user_id uuid not null default auth.uid(),
  table_name text not null,
  row_key text not null,
  deleted_at timestamptz not null default now(),
  primary key (user_id, table_name, row_key)
);

-- Months are identified by their business key (month_key) within a user.
create table if not exists public.months (
  uuid text not null,
  user_id uuid not null default auth.uid(),
  month_key text not null,
  allowance_cents bigint not null,
  starting_reserve_cents bigint not null,
  ending_reserve_cents bigint,
  is_closed boolean not null default false,
  closed_at text,
  updated_at timestamptz not null default now(),
  primary key (user_id, month_key)
);

create table if not exists public.fixed_expenses (
  uuid text primary key,
  user_id uuid not null default auth.uid(),
  name text not null,
  expected_amount_cents bigint not null,
  kind text not null,
  recurrence text not null,
  estimation_strategy text not null,
  average_months integer,
  active boolean not null default true,
  sort_order integer not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists public.budgets (
  uuid text primary key,
  user_id uuid not null default auth.uid(),
  name text not null,
  default_amount_cents bigint not null default 0,
  active boolean not null default true,
  sort_order integer not null default 0,
  color text,
  updated_at timestamptz not null default now()
);

create table if not exists public.yearly_subscriptions (
  uuid text primary key,
  user_id uuid not null default auth.uid(),
  name text not null,
  yearly_amount_cents bigint not null,
  monthly_amount_cents bigint not null,
  started_month text not null,
  billing_month text not null,
  deduct_monthly boolean not null default true,
  active boolean not null default true,
  sort_order integer not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists public.month_fixed_expenses (
  uuid text primary key,
  user_id uuid not null default auth.uid(),
  month_key text not null,
  fixed_expense_uuid text not null,
  expected_amount_cents bigint not null,
  actual_amount_cents bigint,
  updated_at timestamptz not null default now(),
  foreign key (user_id, month_key) references public.months (user_id, month_key) on delete cascade,
  foreign key (fixed_expense_uuid) references public.fixed_expenses (uuid) on delete cascade
);

create table if not exists public.month_budgets (
  uuid text primary key,
  user_id uuid not null default auth.uid(),
  month_key text not null,
  budget_uuid text not null,
  planned_amount_cents bigint not null,
  updated_at timestamptz not null default now(),
  foreign key (user_id, month_key) references public.months (user_id, month_key) on delete cascade,
  foreign key (budget_uuid) references public.budgets (uuid) on delete cascade
);

create table if not exists public.income (
  uuid text primary key,
  user_id uuid not null default auth.uid(),
  month_key text not null,
  date text not null,
  amount_cents bigint not null,
  description text not null,
  note text,
  updated_at timestamptz not null default now(),
  foreign key (user_id, month_key) references public.months (user_id, month_key) on delete cascade
);

create table if not exists public.reserve_transfers (
  uuid text primary key,
  user_id uuid not null default auth.uid(),
  month_key text not null,
  amount_cents bigint not null,
  direction text not null,
  note text,
  updated_at timestamptz not null default now(),
  foreign key (user_id, month_key) references public.months (user_id, month_key) on delete cascade
);

create table if not exists public.transactions (
  uuid text primary key,
  user_id uuid not null default auth.uid(),
  month_key text not null,
  date text not null,
  amount_cents bigint not null,
  budget_uuid text,
  merchant text not null,
  note text,
  origin_type text,
  origin_id text,
  updated_at timestamptz not null default now(),
  foreign key (user_id, month_key) references public.months (user_id, month_key) on delete cascade,
  foreign key (budget_uuid) references public.budgets (uuid) on delete set null
);

create index if not exists idx_months_updated_at on public.months (user_id, updated_at);
create index if not exists idx_fixed_expenses_updated_at on public.fixed_expenses (user_id, updated_at);
create index if not exists idx_budgets_updated_at on public.budgets (user_id, updated_at);
create index if not exists idx_yearly_subscriptions_updated_at on public.yearly_subscriptions (user_id, updated_at);
create index if not exists idx_month_fixed_expenses_updated_at on public.month_fixed_expenses (user_id, updated_at);
create index if not exists idx_month_budgets_updated_at on public.month_budgets (user_id, updated_at);
create index if not exists idx_income_updated_at on public.income (user_id, updated_at);
create index if not exists idx_reserve_transfers_updated_at on public.reserve_transfers (user_id, updated_at);
create index if not exists idx_transactions_updated_at on public.transactions (user_id, updated_at);
create index if not exists idx_settings_updated_at on public.settings (user_id, updated_at);
create index if not exists idx_sync_tombstones_deleted_at on public.sync_tombstones (user_id, deleted_at);

-- RLS: personal rows are only visible to their owner.
do $$
declare
  t text;
begin
  foreach t in array array[
    'settings', 'months', 'fixed_expenses', 'budgets', 'yearly_subscriptions',
    'month_fixed_expenses', 'month_budgets', 'income', 'reserve_transfers',
    'transactions', 'sync_tombstones'
  ]
  loop
    execute format('alter table public.%I enable row level security;', t);
    execute format(
      'create policy %I on public.%I for all using (user_id = auth.uid()) with check (user_id = auth.uid());',
      t || '_owner_access', t
    );
    execute format('grant select, insert, update, delete on public.%I to authenticated, anon;', t);
  end loop;
end $$;