-- Coconut: make shared RLS fully membership-based (idea.txt §12.2).
--
-- Shared rows are protected by the space membership boundary, not by per-row
-- ownership. The previous owner/user-only write policies broke sync as soon as
-- two conditions were met: (a) a pending invitee pushed their accepted space
-- (the space-row update required active membership that was only established
-- remotely by that very push), and (b) a member device re-pushed the full
-- shared dump, which always includes member rows belonging to other members.
--
-- Owner-only checks are retained for shared_spaces INSERT (creation, before a
-- membership can exist) and DELETE (destructive, owner-only).

drop policy if exists shared_spaces_update on public.shared_spaces;
create policy shared_spaces_update on public.shared_spaces
  for update using (
    public.is_space_member(uuid)
    or public.is_space_owner(uuid)
    or public.has_pending_invite(uuid)
  )
  with check (
    public.is_space_member(uuid)
    or public.is_space_owner(uuid)
    or public.has_pending_invite(uuid)
  );

drop policy if exists shared_space_members_insert on public.shared_space_members;
create policy shared_space_members_insert on public.shared_space_members
  for insert with check (
    public.is_space_member(space_uuid)
    or public.is_space_owner(space_uuid)
    or public.has_pending_invite(space_uuid)
    or user_id = auth.uid()
    or email = lower(auth.jwt() ->> 'email')
  );

drop policy if exists shared_space_members_update on public.shared_space_members;
create policy shared_space_members_update on public.shared_space_members
  for update using (
    public.is_space_member(space_uuid)
    or public.is_space_owner(space_uuid)
    or public.has_pending_invite(space_uuid)
    or user_id = auth.uid()
    or email = lower(auth.jwt() ->> 'email')
  )
  with check (
    public.is_space_member(space_uuid)
    or public.is_space_owner(space_uuid)
    or public.has_pending_invite(space_uuid)
    or user_id = auth.uid()
    or email = lower(auth.jwt() ->> 'email')
  );

drop policy if exists shared_space_members_delete on public.shared_space_members;
create policy shared_space_members_delete on public.shared_space_members
  for delete using (
    public.is_space_member(space_uuid)
    or public.is_space_owner(space_uuid)
    or public.has_pending_invite(space_uuid)
    or user_id = auth.uid()
  );