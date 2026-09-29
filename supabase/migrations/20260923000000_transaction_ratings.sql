-- Per-transaction value rating.
--
-- How much value a purchase turned out to be, chosen by the user while
-- reviewing a month before closing it. Nullable: no rating means the user never
-- judged the purchase, which counts as neutral.

alter table public.transactions
  add column if not exists rating text
  check (rating is null or rating in ('regret', 'neutral', 'good'));
