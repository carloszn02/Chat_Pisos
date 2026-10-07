-- Unread counters for district group chats (the "12" badges in the chats list).
-- Each membership remembers when the user last opened that group.

alter table public.group_members
  add column last_read_at timestamptz not null default now();

-- Marks a group as read for the current user (called when the chat is open).
create function public.mark_group_read(target_group uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.group_members
  set last_read_at = now()
  where group_id = target_group
    and user_id = auth.uid();
$$;

-- Unread messages per joined group: newer than the last visit, written by someone else.
-- Runs with the user's own rights, so messages from blocked users are not counted.
create function public.my_group_unread_counts()
returns table (group_id uuid, unread_count integer)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    m.group_id,
    (
      select count(*)::integer
      from public.group_messages g
      where g.group_id = m.group_id
        and g.user_id <> auth.uid()
        and g.created_at > m.last_read_at
    )
  from public.group_members m
  where m.user_id = auth.uid();
$$;

revoke execute on function public.mark_group_read(uuid) from public, anon;
revoke execute on function public.my_group_unread_counts() from public, anon;
grant execute on function public.mark_group_read(uuid) to authenticated;
grant execute on function public.my_group_unread_counts() to authenticated;
