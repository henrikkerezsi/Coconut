-- Period-based subscriptions: the start/end months define the range in which a
-- subscription deducts monthly; total_amount_cents is the whole-period price.
alter table if exists public.yearly_subscriptions
  rename column yearly_amount_cents to total_amount_cents;
alter table if exists public.yearly_subscriptions
  rename column started_month to start_month;
alter table if exists public.yearly_subscriptions
  add column if not exists end_month text not null default '9999-12';
alter table if exists public.yearly_subscriptions
  drop column if exists billing_month;