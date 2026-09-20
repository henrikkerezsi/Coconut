-- Coconut: guarantee shared_spaces owner assignment.
-- Migration 0000 uses `create table if not exists`; if the table already
-- existed without the owner default, inserts omitting owner_user_id would
-- write NULL and fail the insert RLS with-check (owner_user_id = auth.uid()).
-- Make the default and NOT NULL here unconditionally so the server always
-- assigns ownership from the JWT.

alter table public.shared_spaces alter column owner_user_id set default auth.uid();
alter table public.shared_spaces alter column owner_user_id set not null;