-- Private group chats between people who are already connected.
--
-- Rules (all enforced here, not just in the app):
-- * You can only invite people you have an accepted private conversation with.
-- * Nobody can invite someone they blocked or who blocked them.
-- * Invited people must accept before they join (and before they can read anything).
-- * At most 10 people per group (members and pending invitations together).
-- * The creator can remove people; anyone can leave. If the creator leaves, the
--   longest-standing member takes over; an empty group is deleted.
-- Groups, members and invitations are only changed through the functions below.

create table public.private_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 50),
  created_by uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.private_group_members (
  group_id uuid not null references public.private_groups (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  status text not null default 'invited' check (status in ('invited', 'member')),
  invited_by uuid references public.profiles (id) on delete set null,
  last_read_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

create index private_group_members_user_id_idx on public.private_group_members (user_id);

create table public.private_group_messages (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.private_groups (id) on delete cascade,
  sender_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  body text not null,
  listing_id uuid references public.listings (id) on delete set null,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  check (deleted_at is not null or char_length(btrim(body)) between 1 and 2000)
);

create index private_group_messages_group_id_created_at_idx
on public.private_group_messages (group_id, created_at desc);
create index private_group_messages_sender_id_created_at_idx
on public.private_group_messages (sender_id, created_at);
create index private_groups_created_by_created_at_idx
on public.private_groups (created_by, created_at);

-- Helpers ---------------------------------------------------------------------

-- True if the two people have an accepted private conversation.
create function public.are_connected(user1 uuid, user2 uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.conversations
    where user_a = least(user1, user2)
      and user_b = greatest(user1, user2)
      and status = 'accepted'
  );
$$;

-- The current user's membership status in a group ('member', 'invited' or null).
create function public.my_private_group_status(target_group uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select status from public.private_group_members
  where group_id = target_group and user_id = auth.uid();
$$;

revoke execute on function public.are_connected(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.my_private_group_status(uuid) from public, anon;
grant execute on function public.my_private_group_status(uuid) to authenticated;

-- Row Level Security ------------------------------------------------------------

alter table public.private_groups enable row level security;
alter table public.private_group_members enable row level security;
alter table public.private_group_messages enable row level security;

-- Invited people can see the group's name and who is in it (to decide whether to join).
create policy "Members and invited people can view the group"
on public.private_groups for select
to authenticated
using (public.my_private_group_status(id) is not null);

create policy "Members and invited people can view the member list"
on public.private_group_members for select
to authenticated
using (public.my_private_group_status(group_id) is not null);

-- Only members (not pending invitations) read messages, never from people they blocked.
create policy "Members can read messages"
on public.private_group_messages for select
to authenticated
using (
  public.my_private_group_status(group_id) = 'member'
  and not exists (
    select 1 from public.blocks b
    where b.blocker_id = (select auth.uid())
      and b.blocked_id = private_group_messages.sender_id
  )
);

create policy "Members can send messages as themselves"
on public.private_group_messages for insert
to authenticated
with check (
  (select auth.uid()) = sender_id
  and public.my_private_group_status(group_id) = 'member'
);

-- Spam limits (reusing the shared trigger from the launch-hardening migration).
create trigger private_group_messages_rate_limit
before insert on public.private_group_messages
for each row execute function public.enforce_rate_limit('30', '1 minute', 'sender_id');

create trigger private_groups_rate_limit
before insert on public.private_groups
for each row execute function public.enforce_rate_limit('10', '1 day', 'created_by');

-- Functions the app calls ---------------------------------------------------------

-- Checks one invitation and adds it. Used by create and invite.
create function public.add_private_group_invite(target_group uuid, inviter uuid, invitee uuid)
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
  if (select count(*) from public.private_group_members where group_id = target_group) >= 10 then
    raise exception 'group_full';
  end if;

  insert into public.private_group_members (group_id, user_id, role, status, invited_by)
  values (target_group, invitee, 'member', 'invited', inviter)
  on conflict (group_id, user_id) do nothing;
end;
$$;

revoke execute on function public.add_private_group_invite(uuid, uuid, uuid) from public, anon, authenticated;

create function public.create_private_group(group_name text, invitees uuid[])
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  new_group uuid;
  invitee uuid;
begin
  if me is null then
    raise exception 'Not logged in';
  end if;
  if cardinality(invitees) < 1 then
    raise exception 'no_invitees';
  end if;
  if cardinality(array(select distinct unnest(invitees))) > 9 then
    raise exception 'group_full';
  end if;

  insert into public.private_groups (name, created_by) values (btrim(group_name), me)
  returning id into new_group;

  insert into public.private_group_members (group_id, user_id, role, status)
  values (new_group, me, 'owner', 'member');

  foreach invitee in array invitees loop
    perform public.add_private_group_invite(new_group, me, invitee);
  end loop;

  return new_group;
end;
$$;

-- Any member can invite more of their own connections.
create function public.invite_to_private_group(target_group uuid, invitees uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  invitee uuid;
begin
  if public.my_private_group_status(target_group) is distinct from 'member' then
    raise exception 'not_a_member';
  end if;
  foreach invitee in array invitees loop
    perform public.add_private_group_invite(target_group, auth.uid(), invitee);
  end loop;
end;
$$;

-- Accept (join) or decline an invitation.
create function public.respond_to_group_invite(target_group uuid, accept boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if accept then
    update public.private_group_members
    set status = 'member', last_read_at = now()
    where group_id = target_group and user_id = auth.uid() and status = 'invited';
  else
    delete from public.private_group_members
    where group_id = target_group and user_id = auth.uid() and status = 'invited';
  end if;
end;
$$;

-- Leave a group (or decline from inside it). Hands over or deletes the group if needed.
create function public.leave_private_group(target_group uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  was_owner boolean;
  successor uuid;
begin
  delete from public.private_group_members
  where group_id = target_group and user_id = auth.uid()
  returning role = 'owner' into was_owner;

  if not exists (
    select 1 from public.private_group_members where group_id = target_group and status = 'member'
  ) then
    delete from public.private_groups where id = target_group;
    return;
  end if;

  if was_owner then
    select user_id into successor
    from public.private_group_members
    where group_id = target_group and status = 'member'
    order by created_at
    limit 1;
    update public.private_group_members
    set role = 'owner'
    where group_id = target_group and user_id = successor;
  end if;
end;
$$;

-- The owner removes someone (a member or a pending invitation).
create function public.remove_from_private_group(target_group uuid, target_user uuid)
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
  delete from public.private_group_members
  where group_id = target_group and user_id = target_user and user_id <> auth.uid();
end;
$$;

create function public.mark_private_group_read(target_group uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.private_group_members
  set last_read_at = now()
  where group_id = target_group and user_id = auth.uid() and status = 'member';
$$;

-- The current user's private groups for the Messages tab, newest activity first.
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
    case when me.status = 'member' then (
      select count(*)::integer
      from public.private_group_messages pm
      where pm.group_id = g.id
        and pm.sender_id <> auth.uid()
        and pm.deleted_at is null
        and pm.created_at > me.last_read_at
    ) else 0 end
  from public.private_group_members me
  join public.private_groups g on g.id = me.group_id
  left join lateral (
    select pm.body, pm.sender_id, pm.created_at, pm.deleted_at
    from public.private_group_messages pm
    where pm.group_id = g.id
    order by pm.created_at desc
    limit 1
  ) last_message on true
  where me.user_id = auth.uid()
  order by coalesce(last_message.created_at, me.created_at) desc;
$$;

revoke execute on function public.create_private_group(text, uuid[]) from public, anon;
revoke execute on function public.invite_to_private_group(uuid, uuid[]) from public, anon;
revoke execute on function public.respond_to_group_invite(uuid, boolean) from public, anon;
revoke execute on function public.leave_private_group(uuid) from public, anon;
revoke execute on function public.remove_from_private_group(uuid, uuid) from public, anon;
revoke execute on function public.mark_private_group_read(uuid) from public, anon;
revoke execute on function public.my_private_groups() from public, anon;
grant execute on function public.create_private_group(text, uuid[]) to authenticated;
grant execute on function public.invite_to_private_group(uuid, uuid[]) to authenticated;
grant execute on function public.respond_to_group_invite(uuid, boolean) to authenticated;
grant execute on function public.leave_private_group(uuid) to authenticated;
grant execute on function public.remove_from_private_group(uuid, uuid) to authenticated;
grant execute on function public.mark_private_group_read(uuid) to authenticated;
grant execute on function public.my_private_groups() to authenticated;

-- Deleting your own message also works in private groups.
create or replace function public.delete_my_message(kind text, message uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if kind = 'group' then
    update public.group_messages
    set body = '', listing_id = null, deleted_at = now()
    where id = message and user_id = auth.uid() and deleted_at is null;
  elsif kind = 'direct' then
    update public.direct_messages
    set body = '', listing_id = null, deleted_at = now()
    where id = message and sender_id = auth.uid() and deleted_at is null;
  elsif kind = 'private_group' then
    update public.private_group_messages
    set body = '', listing_id = null, deleted_at = now()
    where id = message and sender_id = auth.uid() and deleted_at is null;
  else
    raise exception 'Unknown message kind';
  end if;
end;
$$;

-- Reports can point to a private group message.
alter table public.reports
  add column private_group_message_id uuid references public.private_group_messages (id) on delete set null;

-- Live updates for open group chats and the Messages tab.
alter publication supabase_realtime add table public.private_group_messages, public.private_group_members;
