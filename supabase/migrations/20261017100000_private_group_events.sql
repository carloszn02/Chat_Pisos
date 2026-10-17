-- Notices inside private groups: "Ana created the group", "Bea joined", "Carla left",
-- "Ana removed Dani". They are written by the database whenever membership changes,
-- so they can't be missing or faked, and they never count as unread messages.

alter table public.private_group_messages
  add column kind text not null default 'message' check (kind in ('message', 'event')),
  add column event text check (event in ('created', 'joined', 'left', 'removed')),
  -- For "removed": the person who was removed (sender_id is who removed them).
  add column subject_id uuid references public.profiles (id) on delete set null,
  add constraint private_group_messages_event_shape check ((kind = 'event') = (event is not null));

-- Notices have no text, so the "1 to 2000 characters" rule only applies to real messages.
alter table public.private_group_messages drop constraint private_group_messages_check;
alter table public.private_group_messages
  add constraint private_group_messages_body_check
  check (kind = 'event' or deleted_at is not null or char_length(btrim(body)) between 1 and 2000);

-- People can only send real messages; notices come from the trigger below.
drop policy "Members can send messages as themselves" on public.private_group_messages;
create policy "Members can send messages as themselves"
on public.private_group_messages for insert
to authenticated
with check (
  (select auth.uid()) = sender_id
  and kind = 'message'
  and public.my_private_group_status(group_id) = 'member'
);

create function public.private_group_members_events()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' and new.role = 'owner' and new.status = 'member' then
    insert into public.private_group_messages (group_id, sender_id, body, kind, event)
    values (new.group_id, new.user_id, '', 'event', 'created');
  elsif tg_op = 'UPDATE' and old.status = 'invited' and new.status = 'member' then
    insert into public.private_group_messages (group_id, sender_id, body, kind, event)
    values (new.group_id, new.user_id, '', 'event', 'joined');
  elsif tg_op = 'DELETE' and old.status = 'member' then
    -- Skip when the whole group is being deleted.
    if exists (select 1 from public.private_groups where id = old.group_id) then
      if auth.uid() = old.user_id then
        insert into public.private_group_messages (group_id, sender_id, body, kind, event)
        values (old.group_id, old.user_id, '', 'event', 'left');
      else
        insert into public.private_group_messages (group_id, sender_id, body, kind, event, subject_id)
        values (old.group_id, coalesce(auth.uid(), old.user_id), '', 'event', 'removed', old.user_id);
      end if;
    end if;
  end if;
  return coalesce(new, old);
end;
$$;

revoke execute on function public.private_group_members_events() from public, anon, authenticated;

create trigger private_group_members_events
after insert or update or delete on public.private_group_members
for each row execute function public.private_group_members_events();

-- The Messages tab list: notices show as the last activity but never count as unread.
drop function public.my_private_groups();

create function public.my_private_groups()
returns table (
  id uuid,
  name text,
  my_status text,
  my_role text,
  invited_by uuid,
  member_count integer,
  last_message_body text,
  last_message_sender_id uuid,
  last_message_at timestamptz,
  last_message_deleted boolean,
  last_message_kind text,
  last_message_event text,
  last_message_subject_id uuid,
  unread_count integer
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    g.id,
    g.name,
    me.status,
    me.role,
    me.invited_by,
    (select count(*)::integer from public.private_group_members m where m.group_id = g.id and m.status = 'member'),
    last_message.body,
    last_message.sender_id,
    last_message.created_at,
    last_message.deleted_at is not null,
    last_message.kind,
    last_message.event,
    last_message.subject_id,
    case when me.status = 'member' then (
      select count(*)::integer
      from public.private_group_messages pm
      where pm.group_id = g.id
        and pm.kind = 'message'
        and pm.sender_id <> auth.uid()
        and pm.deleted_at is null
        and pm.created_at > me.last_read_at
    ) else 0 end
  from public.private_group_members me
  join public.private_groups g on g.id = me.group_id
  left join lateral (
    select pm.body, pm.sender_id, pm.created_at, pm.deleted_at, pm.kind, pm.event, pm.subject_id
    from public.private_group_messages pm
    where pm.group_id = g.id
    order by pm.created_at desc
    limit 1
  ) last_message on true
  where me.user_id = auth.uid()
  order by coalesce(last_message.created_at, me.created_at) desc;
$$;

revoke execute on function public.my_private_groups() from public, anon;
grant execute on function public.my_private_groups() to authenticated;
