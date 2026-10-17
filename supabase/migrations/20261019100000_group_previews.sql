-- The Chats tab list in one request: for each district group you joined, the number of
-- unread messages and the latest message (instead of one request per group).
-- Runs with the user's own rights, so messages from blocked users are left out.

create function public.my_group_previews()
returns table (
  group_id uuid,
  unread_count integer,
  last_message_id uuid,
  last_message_user_id uuid,
  last_message_body text,
  last_message_listing_id uuid,
  last_message_deleted_at timestamptz,
  last_message_created_at timestamptz
)
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
        and g.deleted_at is null
        and g.created_at > m.last_read_at
    ),
    last_message.id,
    last_message.user_id,
    last_message.body,
    last_message.listing_id,
    last_message.deleted_at,
    last_message.created_at
  from public.group_members m
  left join lateral (
    select g.id, g.user_id, g.body, g.listing_id, g.deleted_at, g.created_at
    from public.group_messages g
    where g.group_id = m.group_id
    order by g.created_at desc
    limit 1
  ) last_message on true
  where m.user_id = auth.uid();
$$;

revoke execute on function public.my_group_previews() from public, anon;
grant execute on function public.my_group_previews() to authenticated;
