-- Coconut: shared space ownership fix.
-- The client no longer sends owner_user_id; the remote shared_spaces column
-- defaults to auth.uid(), so ownership is assigned server-side on insert.
-- Active members must be able to update (re-push) the space row itself,
-- otherwise a member device syncing a space owned by someone else would be
-- blocked by the owner-only update policy.

drop policy if exists shared_spaces_update on public.shared_spaces;
create policy shared_spaces_update on public.shared_spaces
  for update using (public.is_space_member(uuid) or public.is_space_owner(uuid))
  with check (public.is_space_member(uuid) or public.is_space_owner(uuid));