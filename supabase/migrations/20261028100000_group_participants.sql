-- Participants of district group chats. Each person decides, per group, whether they
-- appear in the list of participants (they do unless they turn it off). Hidden people
-- still count in the number of members.

alter table public.group_members
  add column show_in_members boolean not null default true;

-- Show or hide yourself in a group's list of participants.
create function public.set_group_visibility(target_group uuid, visible boolean)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.group_members
  set show_in_members = visible
  where group_id = target_group
    and user_id = auth.uid();
$$;

revoke execute on function public.set_group_visibility(uuid, boolean) from public, anon;
grant execute on function public.set_group_visibility(uuid, boolean) to authenticated;

-- The people who chose to appear, newest first (at most 300). People you blocked or who
-- blocked you are left out. You always see yourself, so you know how others see the list.
create function public.group_participants(target_group uuid)
returns table (user_id uuid, joined_at timestamptz, show_in_members boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select m.user_id, m.joined_at, m.show_in_members
  from public.group_members m
  where m.group_id = target_group
    and auth.uid() is not null
    and (m.user_id = auth.uid() or m.show_in_members)
    and (m.user_id = auth.uid() or not public.is_blocked_between(auth.uid(), m.user_id))
  order by (m.user_id = auth.uid()) desc, m.joined_at desc
  limit 300;
$$;

revoke execute on function public.group_participants(uuid) from public, anon;
grant execute on function public.group_participants(uuid) to authenticated;
