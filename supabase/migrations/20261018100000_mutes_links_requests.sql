-- Three features:
-- 1. Muting chats (district groups, private groups and private conversations).
-- 2. Activity numbers for district groups, for the "Explore" screens.
-- 3. Invite links for private groups: opening a link sends a join request, and any
--    member of the group can accept or decline it.

------------------------------------------------------------------------------
-- 1. Muted chats
-- One row per chat the user muted. "Until I turn it back on" is stored as 'infinity'.
------------------------------------------------------------------------------

create table public.chat_mutes (
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  chat_kind text not null check (chat_kind in ('group', 'private_group', 'conversation')),
  chat_id uuid not null,
  muted_until timestamptz not null,
  primary key (user_id, chat_kind, chat_id)
);

alter table public.chat_mutes enable row level security;

create policy "Users see their own mutes"
on public.chat_mutes for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users add their own mutes"
on public.chat_mutes for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users change their own mutes"
on public.chat_mutes for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users remove their own mutes"
on public.chat_mutes for delete
to authenticated
using ((select auth.uid()) = user_id);

------------------------------------------------------------------------------
-- 2. District group activity: members, messages in the last 7 days, whether there was
-- a message in the last 24 hours.
-- Only numbers, never who the members are.
------------------------------------------------------------------------------

create function public.chat_group_stats()
returns table (
  group_id uuid,
  member_count integer,
  messages_this_week integer,
  active_today boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    g.id,
    (select count(*)::integer from public.group_members m where m.group_id = g.id),
    (
      select count(*)::integer from public.group_messages gm
      where gm.group_id = g.id
        and gm.deleted_at is null
        and gm.created_at > now() - interval '7 days'
    ),
    exists (
      select 1 from public.group_messages gm
      where gm.group_id = g.id
        and gm.deleted_at is null
        and gm.created_at > now() - interval '1 day'
    )
  from public.chat_groups g;
$$;

revoke execute on function public.chat_group_stats() from public, anon;
grant execute on function public.chat_group_stats() to authenticated;

------------------------------------------------------------------------------
-- 3. Invite links and join requests for private groups
------------------------------------------------------------------------------

-- The owner can turn the group's link off.
alter table public.private_groups
  add column invite_link_enabled boolean not null default true;

-- One link per group, expiring after 30 days. Kept in its own table with no access rules,
-- so only the functions below can read it (members get it through get_private_group_link).
create table public.private_group_links (
  group_id uuid primary key references public.private_groups (id) on delete cascade,
  token text not null unique,
  expires_at timestamptz not null
);

alter table public.private_group_links enable row level security;

-- New membership status: 'requested' = asked to join through a link, waiting for a member.
alter table public.private_group_members drop constraint private_group_members_status_check;
alter table public.private_group_members
  add constraint private_group_members_status_check
  check (status in ('invited', 'member', 'requested'));

-- New notices: "María asked to join" (while pending) and "Bea accepted María".
alter table public.private_group_messages drop constraint private_group_messages_event_check;
alter table public.private_group_messages
  add constraint private_group_messages_event_check
  check (event in ('created', 'joined', 'left', 'removed', 'requested', 'accepted'));

-- True if someone in the group has blocked this person, or this person blocked a member.
-- Such requests stay hidden from the group and can't be accepted.
create function public.blocked_with_group(target_group uuid, person uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.private_group_members m
    where m.group_id = target_group
      and m.status = 'member'
      and public.is_blocked_between(m.user_id, person)
  );
$$;

revoke execute on function public.blocked_with_group(uuid, uuid) from public, anon, authenticated;

-- Members plus pending invitations (join requests don't take a place until accepted).
create function public.private_group_size(target_group uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer from public.private_group_members
  where group_id = target_group and status in ('member', 'invited');
$$;

revoke execute on function public.private_group_size(uuid) from public, anon, authenticated;

-- Invitations: same rules as before, but join requests don't count toward the 10.
create or replace function public.add_private_group_invite(target_group uuid, inviter uuid, invitee uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if invitee = inviter then
    return;
  end if;
  if not public.are_connected(inviter, invitee) then
    raise exception 'not_connected';
  end if;
  if public.is_blocked_between(inviter, invitee) then
    raise exception 'not_connected';
  end if;
  if public.private_group_size(target_group) >= 10 then
    raise exception 'group_full';
  end if;

  insert into public.private_group_members (group_id, user_id, role, status, invited_by)
  values (target_group, invitee, 'member', 'invited', inviter)
  on conflict (group_id, user_id) do nothing;
end;
$$;

-- Notices for every membership change.
create or replace function public.private_group_members_events()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' and new.role = 'owner' and new.status = 'member' then
    insert into public.private_group_messages (group_id, sender_id, body, kind, event)
    values (new.group_id, new.user_id, '', 'event', 'created');
  elsif tg_op = 'INSERT' and new.status = 'requested' then
    -- Hidden requests (blocked by someone in the group) leave no trace in the chat.
    if not public.blocked_with_group(new.group_id, new.user_id) then
      insert into public.private_group_messages (group_id, sender_id, body, kind, event)
      values (new.group_id, new.user_id, '', 'event', 'requested');
    end if;
  elsif tg_op = 'UPDATE' and old.status = 'invited' and new.status = 'member' then
    insert into public.private_group_messages (group_id, sender_id, body, kind, event)
    values (new.group_id, new.user_id, '', 'event', 'joined');
  elsif tg_op = 'UPDATE' and old.status = 'requested' and new.status = 'member' then
    delete from public.private_group_messages
    where group_id = new.group_id and sender_id = new.user_id and event = 'requested';
    insert into public.private_group_messages (group_id, sender_id, body, kind, event, subject_id)
    values (new.group_id, coalesce(auth.uid(), new.user_id), '', 'event', 'accepted', new.user_id);
  elsif tg_op = 'DELETE' and old.status = 'requested' then
    -- Declined or cancelled: the "asked to join" notice disappears.
    delete from public.private_group_messages
    where group_id = old.group_id and sender_id = old.user_id and event = 'requested';
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

-- A member gets the group's link (made on the spot if there is none or it expired).
create function public.get_private_group_link(target_group uuid)
returns table (token text, expires_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.my_private_group_status(target_group) is distinct from 'member' then
    raise exception 'not_a_member';
  end if;
  if not (select invite_link_enabled from public.private_groups where id = target_group) then
    raise exception 'link_disabled';
  end if;
  insert into public.private_group_links (group_id, token, expires_at)
  values (
    target_group,
    replace(gen_random_uuid()::text, '-', ''),
    now() + interval '30 days'
  )
  on conflict (group_id) do update
  set token = excluded.token, expires_at = excluded.expires_at
  where public.private_group_links.expires_at <= now();
  return query
  select l.token, l.expires_at from public.private_group_links l where l.group_id = target_group;
end;
$$;

-- The owner turns the link on or off. Turning it off also kills the old link, so turning
-- it back on gives a new one (that's how "replace the link" works too).
create function public.set_private_group_link(target_group uuid, enabled boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.private_group_members
    where group_id = target_group and user_id = auth.uid() and role = 'owner'
  ) then
    raise exception 'not_owner';
  end if;
  update public.private_groups set invite_link_enabled = enabled where id = target_group;
  delete from public.private_group_links where group_id = target_group;
end;
$$;

-- What someone sees when they open a link: the group's name and who is in it, never
-- the messages. Returns nothing if the link is wrong, expired or turned off (unless
-- you are already in the group).
create function public.private_group_link_preview(link_token text)
returns table (
  group_id uuid,
  name text,
  member_ids uuid[],
  my_status text,
  is_full boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    g.id,
    g.name,
    array(
      select m.user_id from public.private_group_members m
      where m.group_id = g.id and m.status = 'member'
      order by m.created_at
    ),
    (select me.status from public.private_group_members me
     where me.group_id = g.id and me.user_id = auth.uid()),
    public.private_group_size(g.id) >= 10
  from public.private_group_links l
  join public.private_groups g on g.id = l.group_id
  where l.token = link_token
    and (
      (g.invite_link_enabled and l.expires_at > now())
      or exists (
        select 1 from public.private_group_members me
        where me.group_id = g.id and me.user_id = auth.uid()
      )
    );
$$;

-- Ask to join through a link. Returns your status in the group afterwards.
create function public.request_to_join_private_group(link_token text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  target_group uuid;
  current_status text;
begin
  if me is null then
    raise exception 'Not logged in';
  end if;

  select g.id into target_group
  from public.private_group_links l
  join public.private_groups g on g.id = l.group_id
  where l.token = link_token and g.invite_link_enabled and l.expires_at > now();
  if target_group is null then
    raise exception 'link_invalid';
  end if;

  select status into current_status from public.private_group_members
  where group_id = target_group and user_id = me;
  if current_status is not null then
    return current_status;
  end if;

  if public.private_group_size(target_group) >= 10 then
    raise exception 'group_full';
  end if;
  -- Spam limit: at most 20 join requests a day.
  if (
    select count(*) from public.private_group_members
    where user_id = me and status = 'requested' and created_at > now() - interval '1 day'
  ) >= 20 then
    raise exception 'rate_limited';
  end if;

  insert into public.private_group_members (group_id, user_id, role, status)
  values (target_group, me, 'member', 'requested');
  return 'requested';
end;
$$;

-- Pending join requests for the members of a group (hidden ones left out).
create function public.private_group_join_requests(target_group uuid)
returns table (user_id uuid, requested_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select m.user_id, m.created_at
  from public.private_group_members m
  where m.group_id = target_group
    and m.status = 'requested'
    and public.my_private_group_status(target_group) = 'member'
    and not public.blocked_with_group(target_group, m.user_id)
  order by m.created_at;
$$;

-- Any member accepts or declines a request.
create function public.respond_to_join_request(target_group uuid, target_user uuid, accept boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.my_private_group_status(target_group) is distinct from 'member' then
    raise exception 'not_a_member';
  end if;
  if not exists (
    select 1 from public.private_group_members
    where group_id = target_group and user_id = target_user and status = 'requested'
  ) or public.blocked_with_group(target_group, target_user) then
    raise exception 'request_not_found';
  end if;

  if accept then
    if public.private_group_size(target_group) >= 10 then
      raise exception 'group_full';
    end if;
    update public.private_group_members
    set status = 'member', last_read_at = now(), invited_by = auth.uid()
    where group_id = target_group and user_id = target_user;
  else
    delete from public.private_group_members
    where group_id = target_group and user_id = target_user;
  end if;
end;
$$;

revoke execute on function public.get_private_group_link(uuid) from public, anon;
revoke execute on function public.set_private_group_link(uuid, boolean) from public, anon;
revoke execute on function public.private_group_link_preview(text) from public, anon;
revoke execute on function public.request_to_join_private_group(text) from public, anon;
revoke execute on function public.private_group_join_requests(uuid) from public, anon;
revoke execute on function public.respond_to_join_request(uuid, uuid, boolean) from public, anon;
grant execute on function public.get_private_group_link(uuid) to authenticated;
grant execute on function public.set_private_group_link(uuid, boolean) to authenticated;
grant execute on function public.private_group_link_preview(text) to authenticated;
grant execute on function public.request_to_join_private_group(text) to authenticated;
grant execute on function public.private_group_join_requests(uuid) to authenticated;
grant execute on function public.respond_to_join_request(uuid, uuid, boolean) to authenticated;

-- The Messages tab list, now with the number of pending join requests and whether the
-- invite link is on. Groups you only asked to join are left out.
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
  unread_count integer,
  pending_requests integer,
  invite_link_enabled boolean
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
    ) else 0 end,
    case when me.status = 'member' then (
      select count(*)::integer from public.private_group_join_requests(g.id)
    ) else 0 end,
    g.invite_link_enabled
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
    and me.status in ('member', 'invited')
  order by coalesce(last_message.created_at, me.created_at) desc;
$$;

revoke execute on function public.my_private_groups() from public, anon;
grant execute on function public.my_private_groups() to authenticated;
