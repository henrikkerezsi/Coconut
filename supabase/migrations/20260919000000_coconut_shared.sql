-- Coconut: shared spaces (optional).
-- Shared data is visible only to the active members of the owning space, which
-- is the unit of row-level security here (instead of user_id = auth.uid()).

-- ---------------------------------------------------------------------------
-- Membership helpers (security definer so policy subqueries bypass member RLS)
-- ---------------------------------------------------------------------------
create or replace function public.is_space_owner(space_uuid text)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.shared_spaces s
    where s.uuid = space_uuid and s.owner_user_id = auth.uid()
  );
$$;

create or replace function public.is_space_member(space_uuid text)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.shared_space_members m
    where m.space_uuid = space_uuid
      and m.user_id = auth.uid()
      and m.status = 'active'
  );
$$;

create or replace function public.has_pending_invite(space_uuid text)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.shared_space_members m
    where m.space_uuid = space_uuid
      and m.status = 'pending'
      and m.email = lower(auth.jwt() ->> 'email')
  );
$$;

create or replace function public.is_expense_space_member(expense_uuid text)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.shared_expenses e
    where e.uuid = expense_uuid
      and public.is_space_member(e.space_uuid)
  );
$$;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table if not exists public.shared_spaces (
  uuid text primary key,
  name text not null,
  owner_user_id uuid not null default auth.uid(),
  deleted boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists public.shared_space_members (
  uuid text primary key,
  space_uuid text not null references public.shared_spaces (uuid) on delete cascade,
  user_id uuid,
  email text,
  display_name text,
  role text not null default 'member',
  status text not null default 'pending',
  joined_at text,
  updated_at timestamptz not null default now()
);

create table if not exists public.shared_periods (
  uuid text primary key,
  space_uuid text not null references public.shared_spaces (uuid) on delete cascade,
  start_date text not null,
  end_date text,
  status text not null default 'open',
  updated_at timestamptz not null default now()
);

create table if not exists public.shared_expenses (
  uuid text primary key,
  space_uuid text not null references public.shared_spaces (uuid) on delete cascade,
  period_uuid text not null references public.shared_periods (uuid) on delete cascade,
  description text not null,
  total_amount_cents bigint not null,
  date text not null,
  paid_by_member_uuid text not null references public.shared_space_members (uuid),
  note text,
  created_by_user_id uuid,
  deleted boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists public.shared_expense_splits (
  uuid text primary key,
  expense_uuid text not null references public.shared_expenses (uuid) on delete cascade,
  member_uuid text not null references public.shared_space_members (uuid),
  amount_cents bigint not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.shared_period_reports (
  uuid text primary key,
  space_uuid text not null references public.shared_spaces (uuid) on delete cascade,
  period_uuid text not null references public.shared_periods (uuid) on delete cascade,
  report_json text not null,
  closed_at text not null,
  closed_by_member_uuid text references public.shared_space_members (uuid),
  updated_at timestamptz not null default now()
);

create table if not exists public.shared_sync_tombstones (
  space_uuid text not null references public.shared_spaces (uuid) on delete cascade,
  table_name text not null,
  row_key text not null,
  deleted_at timestamptz not null default now(),
  primary key (space_uuid, table_name, row_key)
);

create unique index if not exists idx_shared_space_members_user
  on public.shared_space_members (space_uuid, user_id)
  where user_id is not null;
create unique index if not exists idx_shared_space_members_email
  on public.shared_space_members (space_uuid, lower(email))
  where email is not null;

create index if not exists idx_shared_spaces_updated_at on public.shared_spaces (updated_at);
create index if not exists idx_shared_space_members_updated_at on public.shared_space_members (updated_at);
create index if not exists idx_shared_periods_updated_at on public.shared_periods (updated_at);
create index if not exists idx_shared_expenses_updated_at on public.shared_expenses (space_uuid, updated_at);
create index if not exists idx_shared_expense_splits_updated_at on public.shared_expense_splits (updated_at);
create index if not exists idx_shared_period_reports_updated_at on public.shared_period_reports (space_uuid, updated_at);
create index if not exists idx_shared_sync_tombstones_deleted_at on public.shared_sync_tombstones (space_uuid, deleted_at);

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------
alter table public.shared_spaces enable row level security;
alter table public.shared_space_members enable row level security;
alter table public.shared_periods enable row level security;
alter table public.shared_expenses enable row level security;
alter table public.shared_expense_splits enable row level security;
alter table public.shared_period_reports enable row level security;
alter table public.shared_sync_tombstones enable row level security;

-- Spaces: visible to members and pending invitees; writable by the owner.
create policy shared_spaces_select on public.shared_spaces
  for select using (
    public.is_space_member(uuid)
    or public.is_space_owner(uuid)
    or public.has_pending_invite(uuid)
  );
create policy shared_spaces_insert on public.shared_spaces
  for insert with check (owner_user_id = auth.uid());
create policy shared_spaces_update on public.shared_spaces
  for update using (owner_user_id = auth.uid()) with check (owner_user_id = auth.uid());
create policy shared_spaces_delete on public.shared_spaces
  for delete using (owner_user_id = auth.uid());

-- Members: visible to the space, the invitee's own email, and the user themself.
create policy shared_space_members_select on public.shared_space_members
  for select using (
    public.is_space_member(space_uuid)
    or public.is_space_owner(space_uuid)
    or user_id = auth.uid()
    or email = lower(auth.jwt() ->> 'email')
  );
create policy shared_space_members_insert on public.shared_space_members
  for insert with check (
    public.is_space_owner(space_uuid)
    or user_id = auth.uid()
    or email = lower(auth.jwt() ->> 'email')
  );
create policy shared_space_members_update on public.shared_space_members
  for update using (
    public.is_space_owner(space_uuid)
    or user_id = auth.uid()
    or email = lower(auth.jwt() ->> 'email')
  ) with check (
    public.is_space_owner(space_uuid)
    or user_id = auth.uid()
    or email = lower(auth.jwt() ->> 'email')
  );
create policy shared_space_members_delete on public.shared_space_members
  for delete using (
    public.is_space_owner(space_uuid)
    or user_id = auth.uid()
  );

-- Periods, expenses, reports: only active members (owner included).
create policy shared_periods_member on public.shared_periods
  for all using (public.is_space_member(space_uuid) or public.is_space_owner(space_uuid))
  with check (public.is_space_member(space_uuid) or public.is_space_owner(space_uuid));

create policy shared_expenses_member on public.shared_expenses
  for all using (public.is_space_member(space_uuid) or public.is_space_owner(space_uuid))
  with check (public.is_space_member(space_uuid) or public.is_space_owner(space_uuid));

create policy shared_period_reports_member on public.shared_period_reports
  for all using (public.is_space_member(space_uuid) or public.is_space_owner(space_uuid))
  with check (public.is_space_member(space_uuid) or public.is_space_owner(space_uuid));

-- Splits: derive the space from the parent expense.
create policy shared_expense_splits_member on public.shared_expense_splits
  for all using (public.is_expense_space_member(expense_uuid))
  with check (public.is_expense_space_member(expense_uuid));

-- Shared tombstones: members of the owning space.
create policy shared_sync_tombstones_member on public.shared_sync_tombstones
  for all using (public.is_space_member(space_uuid) or public.is_space_owner(space_uuid))
  with check (public.is_space_member(space_uuid) or public.is_space_owner(space_uuid));

grant select, insert, update, delete on public.shared_spaces to authenticated, anon;
grant select, insert, update, delete on public.shared_space_members to authenticated, anon;
grant select, insert, update, delete on public.shared_periods to authenticated, anon;
grant select, insert, update, delete on public.shared_expenses to authenticated, anon;
grant select, insert, update, delete on public.shared_expense_splits to authenticated, anon;
grant select, insert, update, delete on public.shared_period_reports to authenticated, anon;
grant select, insert, update, delete on public.shared_sync_tombstones to authenticated, anon;
grant execute on function public.is_space_owner(text) to authenticated, anon;
grant execute on function public.is_space_member(text) to authenticated, anon;
grant execute on function public.has_pending_invite(text) to authenticated, anon;
grant execute on function public.is_expense_space_member(text) to authenticated, anon;
