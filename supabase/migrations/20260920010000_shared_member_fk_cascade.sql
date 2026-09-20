-- Coconut: cascade member deletions to child rows (shared space teardown).
--
-- Deleting a shared space relies on the remote ON DELETE CASCADE chain to wipe
-- every child row. shared_space_members rows are deleted by that cascade, but
-- the FKs from expenses/splits/reports back to shared_space_members were
-- created with the default action (NO ACTION). Postgres does not guarantee the
-- order in which independent cascade paths are processed, so a member row can
-- be deleted while shared_expense_splits rows still reference it, failing with:
--   update or delete on table "shared_space_members" violates foreign key
--   constraint "shared_expense_splits_member_uuid_fkey" ...
--
-- Member rows are never hard-deleted outside a whole-space teardown (leaving a
-- space flips status to 'left'), so an ON DELETE CASCADE here can only fire in
-- the exact scenario it is meant to support.

alter table public.shared_expenses
  drop constraint if exists shared_expenses_paid_by_member_uuid_fkey,
  add constraint shared_expenses_paid_by_member_uuid_fkey
    foreign key (paid_by_member_uuid) references public.shared_space_members (uuid)
    on delete cascade;

alter table public.shared_expense_splits
  drop constraint if exists shared_expense_splits_member_uuid_fkey,
  add constraint shared_expense_splits_member_uuid_fkey
    foreign key (member_uuid) references public.shared_space_members (uuid)
    on delete cascade;

alter table public.shared_period_reports
  drop constraint if exists shared_period_reports_closed_by_member_uuid_fkey,
  add constraint shared_period_reports_closed_by_member_uuid_fkey
    foreign key (closed_by_member_uuid) references public.shared_space_members (uuid)
    on delete cascade;