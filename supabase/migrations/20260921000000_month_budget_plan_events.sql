-- The record of how a month's plan was arrived at: the amount each budget
-- started at, every explicit change to it afterwards, and every explicit change
-- to the planned reserve draw together with the budget the money was handed to.
--
-- A row is written only when the user explicitly re-plans, so this mirrors
-- decisions rather than the plan itself; the plan stays in month_budgets.
create table if not exists public.month_budget_plan_events (
  uuid text primary key,
  user_id uuid not null default auth.uid(),
  month_key text not null,
  kind text not null check (kind in ('initial', 'budget', 'draw')),
  budget_uuid text,
  previous_amount_cents bigint not null,
  new_amount_cents bigint not null,
  funded_budget_uuid text,
  updated_at timestamptz not null default now(),
  foreign key (user_id, month_key) references public.months (user_id, month_key) on delete cascade,
  foreign key (budget_uuid) references public.budgets (uuid) on delete set null,
  foreign key (funded_budget_uuid) references public.budgets (uuid) on delete set null
);

create index if not exists idx_month_budget_plan_events_updated_at
  on public.month_budget_plan_events (user_id, updated_at);

-- Personal rows are only visible to their owner, like every other personal table.
alter table public.month_budget_plan_events enable row level security;

create policy month_budget_plan_events_owner_access
  on public.month_budget_plan_events
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

grant select, insert, update, delete on public.month_budget_plan_events to authenticated, anon;
