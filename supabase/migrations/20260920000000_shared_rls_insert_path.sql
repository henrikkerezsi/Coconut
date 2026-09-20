-- Coconut: allow first-time shared inserts to pass the upsert SELECT check.
--
-- Pushing shared rows uses PostgREST upserts (INSERT ... ON CONFLICT (uuid)
-- DO UPDATE). Per PostgreSQL RLS semantics, an INSERT with an ON CONFLICT
-- arbiter checks the proposed row against the table's SELECT policy too. The
-- shared_spaces SELECT policy only evaluates membership/ownership lookups
-- (is_space_member / is_space_owner / has_pending_invite), none of which can
-- be true for a space row that does not exist yet, so pushing a brand-new
-- space always failed with
-- "new row violates row-level security policy for table shared_spaces".
--
-- Grant the creator visibility over the row they are inserting by matching
-- ownership on the row itself, mirroring the shared_spaces INSERT policy
-- (owner_user_id = auth.uid()). The client-side change to use a plain insert
-- for brand-new rows is redundant with this, so every deployment stays fixed
-- no matter which layer is applied first.

drop policy if exists shared_spaces_select on public.shared_spaces;
create policy shared_spaces_select on public.shared_spaces
  for select using (
    public.is_space_member(uuid)
    or public.is_space_owner(uuid)
    or public.has_pending_invite(uuid)
    or owner_user_id = auth.uid()
  );